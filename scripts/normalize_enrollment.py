"""Build a local SQLite store from the nine original school aggregates (stdlib only)."""
import argparse, csv, hashlib, json, os, pathlib, re, sqlite3, datetime

VERSION = 1
REGIONS = {'Region I':'Ilocos Region','Region II':'Cagayan Valley','Region III':'Central Luzon','Region IV-A':'CALABARZON','Region IV-B':'MIMAROPA','Region V':'Bicol Region','Region VI':'Western Visayas','Region VII':'Central Visayas','Region VIII':'Eastern Visayas','Region IX':'Zamboanga Peninsula','Region X':'Northern Mindanao','Region XI':'Davao Region','Region XII':'SOCCSKSARGEN','CARAGA':'Caraga','Region XIII':'Caraga','ARMM':'BARMM'}
LEVELS = {'region':['region'], 'division':['region','division'], 'province':['region','province'], 'municipality':['region','province','municipality'], 'barangay':['region','province','municipality','barangay']}

def flag(value):
    value=value.strip().lower()
    if value in ('yes','true'): return 1
    if value in ('no','false'): return 0
    if not value: return None
    raise ValueError('Unknown offering flag: '+value)

def count(value):
    value=value.strip()
    if not value: return None
    if not re.fullmatch(r'\d+',value): raise ValueError('Invalid enrollment count: '+value)
    return int(value)

def normalize(row, year, columns):
    school_id=row['school_id'].strip()
    if not re.fullmatch(r'\d+',school_id): raise ValueError('Invalid school ID: '+school_id)
    counts={c:count(row[c]) for c in columns}
    male=sum(v for c,v in counts.items() if c.endswith('_male') and v is not None)
    female=sum(v for c,v in counts.items() if c.endswith('_female') and v is not None)
    known=sum(v is not None for v in counts.values())
    male_known=any(v is not None for c,v in counts.items() if c.endswith('_male'))
    female_known=any(v is not None for c,v in counts.items() if c.endswith('_female'))
    geo=[REGIONS.get(row['region'].strip(),row['region'].strip())]
    geo += [' '.join(row[k].split()).upper() or '(Unspecified)' for k in ['division','province','municipality','barangay']]
    return (school_id,year,row['school_name'].strip(),*geo,row['region'].strip(),row['sector'].strip().title() or '(Unspecified)',row.get('Modified Curricular Offering Classification','').strip() or None,
            flag(row['offers_es']),flag(row['offers_jhs']),flag(row['offers_shs']),male+female if known else None,male if male_known else None,female if female_known else None,known,len(columns),json.dumps(list(counts.values()),separators=(',',':')))

def build(source, output):
    output.mkdir(parents=True,exist_ok=True)
    temp=output/'enrollment.build.sqlite'
    if temp.exists(): temp.unlink()
    db=sqlite3.connect(temp)
    db.executescript('''
      PRAGMA journal_mode=OFF;
      CREATE TABLE enrollment(school_id TEXT, year INTEGER, school_name TEXT, region TEXT, division TEXT, province TEXT, municipality TEXT, barangay TEXT, source_region TEXT, sector TEXT, curriculum TEXT, offers_es INTEGER, offers_jhs INTEGER, offers_shs INTEGER, total INTEGER, male INTEGER, female INTEGER, known_cells INTEGER, source_cells INTEGER, breakdown TEXT, PRIMARY KEY(school_id,year));
      CREATE TABLE metadata(key TEXT PRIMARY KEY, value TEXT);
    ''')
    manifest={'schemaVersion':VERSION,'generatedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'source':'User-supplied DepEd school enrollment CSV extracts','files':[]}
    try:
        for year in range(2017,2026):
            name=f'enrollment_{year}-{str(year+1)[2:]}.csv'; file=source/name
            raw=file.read_bytes(); sha=hashlib.sha256(raw).hexdigest()
            encoding='utf-8-sig'
            try: raw.decode(encoding)
            except UnicodeDecodeError: encoding='cp1252'
            with file.open(encoding=encoding,newline='') as stream:
                reader=csv.DictReader(stream)
                columns=[c for c in reader.fieldnames if re.fullmatch(r'(?:kinder|esng|jhsng|g\d+(?:_[a-z]+)*)_(?:male|female)',c)]
                if not columns: raise ValueError(f'No count columns in {name}')
                unknown=[c for c in reader.fieldnames if c.endswith(('_male','_female')) and c not in columns]
                if unknown: raise ValueError('Unrecognized count columns: '+str(unknown))
                rows=0
                for row in reader:
                    if None in row: raise ValueError(f'Malformed CSV row in {name}:{rows+2}')
                    try: db.execute('INSERT INTO enrollment VALUES ('+','.join('?'*20)+')', normalize(row,year,columns))
                    except Exception as e: raise ValueError(f'{name}:{rows+2}: {e}') from e
                    rows+=1
            total,known,cells=db.execute('SELECT SUM(total),SUM(known_cells),SUM(source_cells) FROM enrollment WHERE year=?',(year,)).fetchone()
            manifest['files'].append(dict(file=name,encoding=encoding,year=year,schoolYear=f'{year}-{str(year+1)[2:]}',rows=rows,enrollment=total,knownCells=known,sourceCells=cells,sha256=sha,countColumns=columns))
            db.commit(); print(f'{name}: {rows:,} school records; {total:,} reported enrollments',flush=True)
        for level,cols in LEVELS.items():
            db.execute(f'CREATE INDEX idx_{level} ON enrollment({",".join(cols)},year,sector)')
        db.execute('CREATE INDEX idx_year ON enrollment(year,sector)')
        db.execute('CREATE INDEX idx_name ON enrollment(school_name)')
        db.execute('INSERT INTO metadata VALUES (?,?)',('manifest',json.dumps(manifest)))
        db.commit()
        assert db.execute('PRAGMA integrity_check').fetchone()[0]=='ok'
    finally: db.close()
    os.replace(temp,output/'enrollment.sqlite')
    (output/'manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
    print('Ready: '+str(output/'enrollment.sqlite'),flush=True)

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source',required=True,type=pathlib.Path)
    parser.add_argument('--output',default='data',type=pathlib.Path)
    args=parser.parse_args(); build(args.source,args.output)
