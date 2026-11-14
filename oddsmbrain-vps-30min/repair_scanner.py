"""OddsMBrain v3 repair. Safe: does not contact OddsPapi while updating."""
from pathlib import Path
import ast, shutil
P=Path(__file__).resolve().parent
F=P/'app.py'
s=F.read_text(encoding='utf-8-sig')
if '# ODDSMBRAIN_PATCH_V3' in s:
    print('Scanner gia aggiornato.')
    raise SystemExit(0)
if 'def scan():' not in s or 'def api(path,**params):' not in s:
    raise SystemExit('Versione app.py sconosciuta; nessun file modificato')
s=s.replace("INTERVAL = max(1800,int(os.getenv('ODDSMBRAIN_SCAN_INTERVAL','1800')))","INTERVAL = max(21600,int(os.getenv('ODDSMBRAIN_SCAN_INTERVAL','86400')))")
s=s.replace("MAX_DAILY = max(1,int(os.getenv('ODDSMBRAIN_MAX_REQUESTS_DAY','24')))","MAX_DAILY = max(1,min(8,int(os.getenv('ODDSMBRAIN_MAX_REQUESTS_DAY','6'))))\nMAX_MONTHLY = max(1,min(180,int(os.getenv('ODDSMBRAIN_MAX_REQUESTS_MONTH','120'))))")
s=s.replace("USAGE = {'date':None,'requests':0}","USAGE = {'date':None,'requests':0,'month':None,'monthRequests':0}")
a=s.index('def api(path,**params):')
b=s.index('\ndef fixtures(',a)
s=s[:a]+'''def api(path,**params):
    with LOCK:
        now=utc();day=now.date().isoformat();month=now.strftime('%Y-%m')
        if USAGE.get('month')!=month: USAGE.update(month=month,monthRequests=0)
        if USAGE.get('date')!=day: USAGE.update(date=day,requests=0)
        if USAGE['requests']>=MAX_DAILY: raise RuntimeError('Limite giornaliero locale OddsPapi raggiunto')
        if USAGE['monthRequests']>=MAX_MONTHLY: raise RuntimeError('Limite mensile locale OddsPapi raggiunto')
        USAGE['requests']+=1;USAGE['monthRequests']+=1
        STATE['requestsToday']=USAGE['requests']
        STATE['requestsMonth']=USAGE['monthRequests']
        STATE['requestBudgetMonth']=MAX_MONTHLY
        USAGEFILE.parent.mkdir(parents=True,exist_ok=True)
        tmp=USAGEFILE.with_suffix('.tmp')
        tmp.write_text(json.dumps(USAGE),encoding='utf-8');tmp.replace(USAGEFILE)
    url='https://api.oddspapi.io/v4/'+path+'?'+parse.urlencode({'apiKey':KEY,**params})
    try:
        with request.urlopen(request.Request(url,headers={'Accept':'application/json'}),timeout=25) as resp:return json.load(resp)
    except error.HTTPError as exc:raise RuntimeError('OddsPapi HTTP '+str(exc.code)) from None
    except (error.URLError,TimeoutError):raise RuntimeError('Connessione OddsPapi non disponibile') from None

'''+s[b+1:]
a=s.index('def get_market_map():')
b=s.index('    try:',a)
s=s[:b]+'''    catalog=ROOT/'cache'/'markets.json'
    try:
        cached=json.loads(catalog.read_text(encoding='utf-8'))
        if isinstance(cached,dict) and len(cached)>=2:return cached
    except (OSError,ValueError,TypeError):pass
'''+s[b:]
s=s.replace("logging.info('Market metadata: %d eligible markets',len(result))\n        return result","logging.info('Market metadata: %d eligible markets',len(result))\n        if result:\n            catalog.parent.mkdir(parents=True,exist_ok=True)\n            catalog.write_text(json.dumps(result),encoding='utf-8')\n        return result")
a=s.index('def scan():')
b=s.index('\ndef loop():',a)
s=s[:a]+'''def scan():
    now=utc();end=now+dt.timedelta(hours=WINDOW_HOURS)
    if USAGE.get('month')==now.strftime('%Y-%m') and USAGE.get('monthRequests',0)>=MAX_MONTHLY-3:
        raise RuntimeError('Quota mensile locale quasi esaurita: scansione sospesa')
    mapping=get_market_map()
    data=api('fixtures',sportId=10,**{'from':iso(now).split('.')[0]+'Z','to':iso(end).split('.')[0]+'Z'},statusId=0,hasOdds='true',bookmakers=','.join(BOOKS+[EX]))
    items=[f for f in fixtures(data) if isinstance(f,dict) and f.get('fixtureId') and f.get('hasOdds') is not False]
    major=('premier league','serie a','la liga','bundesliga','ligue 1','champions league','europa league','eredivisie')
    def priority(f):
        league=str(f.get('tournamentName') or '').lower()
        active=f.get('bookmakerOdds') or {}
        both=bool(active.get(EX)) and any(active.get(b) for b in BOOKS)
        return (0 if both else 1,0 if any(x in league for x in major) else 1,str(f.get('startTime') or ''))
    items.sort(key=priority)
    cursor_file=ROOT/'cache'/'cursor.json'
    try:cursor=int(json.loads(cursor_file.read_text(encoding='utf-8')).get('index',0))
    except (OSError,ValueError,TypeError):cursor=0
    start=cursor%max(1,len(items));pool=items[start:]+items[:start];selected=pool[:MAX_FIXTURES]
    rows=[];checked=0;valid_books=0;valid_exchange=0;market_hits=0
    for f in selected:
        try:
            detail=api('odds',fixtureId=f['fixtureId'],bookmakers=','.join(BOOKS+[EX]),oddsFormat='decimal',verbosity=3)
            if not isinstance(detail,dict):continue
            for k in ('participant1Name','participant2Name','startTime','tournamentName'):detail.setdefault(k,f.get(k))
            has_book=any(selections(detail,b,mapping) for b in BOOKS)
            has_exchange=bool(selections(detail,EX,mapping))
            valid_books+=int(has_book);valid_exchange+=int(has_exchange)
            market_hits+=sum(len(selections(detail,b,mapping)) for b in BOOKS+[EX])
            rows.extend(compare(detail,mapping));checked+=1
            time.sleep(.6)
        except RuntimeError as exc:
            if 'Limite ' in str(exc):break
            logging.warning('Fixture %s: %s',f['fixtureId'],exc)
    cursor_file.parent.mkdir(parents=True,exist_ok=True)
    cursor_file.write_text(json.dumps({'index':(start+len(selected))%max(1,len(items))}),encoding='utf-8')
    rows.sort(key=lambda r:r['rating'],reverse=True)
    diag={'fixturesWithBookOdds':valid_books,'fixturesWithExchangeOdds':valid_exchange,'marketSelectionsFound':market_hits,'bookmakersUsed':BOOKS,'exchangeUsed':EX}
    with LOCK:STATE.update(updatedAt=iso(utc()),rows=rows[:1000],error=None,fixturesReceived=len(items),fixturesWithOdds=len(items),fixturesExamined=checked,diagnostics=diag)
    save_cache();push_cache_to_site()
    logging.info('Scanned %d/%d fixtures; %d ratings; book odds in %d; exchange odds in %d; selections %d; monthly requests %d/%d',checked,len(items),len(rows),valid_books,valid_exchange,market_hits,USAGE.get('monthRequests',0),MAX_MONTHLY)

'''+s[b+1:]
s=s.replace("logging.info('OddsMBrain started on http://127.0.0.1:8765 — interval %ss, daily budget %d',INTERVAL,MAX_DAILY)","logging.info('OddsMBrain started on http://127.0.0.1:8765 — interval %ss, daily budget %d, monthly budget %d',INTERVAL,MAX_DAILY,MAX_MONTHLY)")
s='# ODDSMBRAIN_PATCH_V3\n'+s
ast.parse(s)
backup=F.with_name('app.py.before-fix')
if not backup.exists():shutil.copy2(F,backup)
F.write_text(s,encoding='utf-8')
env=P/'.env'
if env.exists():
    settings={'ODDSMBRAIN_SCAN_INTERVAL':'86400','ODDSMBRAIN_MAX_FIXTURES':'2','ODDSMBRAIN_MAX_REQUESTS_DAY':'6','ODDSMBRAIN_MAX_REQUESTS_MONTH':'120'}
    lines=env.read_text(encoding='utf-8-sig').splitlines();used=set();out=[]
    for line in lines:
        if '=' in line and not line.lstrip().startswith('#') and line.split('=',1)[0].strip() in settings:
            k=line.split('=',1)[0].strip();out.append(k+'='+settings[k]);used.add(k)
        else:out.append(line)
    for k,v in settings.items():
        if k not in used:out.append(k+'='+v)
    env.write_text('\n'.join(out)+'\n',encoding='utf-8')
print('OK scanner aggiornato: scansione ogni 24 ore, tetto locale 120 richieste/mese.')
print('Nessuna chiamata OddsPapi effettuata. Backup: app.py.before-fix')
