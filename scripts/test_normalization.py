import csv, json, pathlib, sqlite3, sys, unittest
sys.path.insert(0,str(pathlib.Path(__file__).parent))
from normalize_enrollment import normalize, flag, count, LEVELS

class NormalizationTests(unittest.TestCase):
    def test_null_zero_and_flags(self):
        self.assertIsNone(count('')); self.assertEqual(count('0'),0)
        self.assertEqual(flag('Yes'),flag('True')); self.assertEqual(flag('No'),flag('False'))
        for v in ['-1','2.5','bad']:
            with self.assertRaises(ValueError): count(v)
        row=dict(school_id='00123',school_name='Niño',region='ARMM',division=' a ',province='p',municipality='m',barangay='',sector='Public',offers_es='Yes',offers_jhs='No',offers_shs='No',kinder_male='',kinder_female='0')
        result=normalize(row,2025,['kinder_male','kinder_female'])
        self.assertEqual(result[0],'00123');self.assertEqual(result[3],'BARMM');self.assertEqual(result[8],'ARMM')
        self.assertIsNone(result[15]);self.assertEqual(result[16],0)
        self.assertEqual(json.loads(result[-1]),[None,0])

def verify_sources(source):
    db=sqlite3.connect('data/enrollment.sqlite')
    manifest=json.loads(db.execute("SELECT value FROM metadata WHERE key='manifest'").fetchone()[0])
    for f in manifest['files']:
        rows=0; total=0; male=0; female=0; columns=f['countColumns']
        with (source/f['file']).open(encoding=f['encoding'],newline='') as stream:
            for row in csv.DictReader(stream):
                rows+=1
                values=[int(row[c]) if row[c].strip() else None for c in columns]
                total+=sum(v for v in values if v is not None)
                male+=sum(v for c,v in zip(columns,values) if c.endswith('_male') and v is not None)
                female+=sum(v for c,v in zip(columns,values) if c.endswith('_female') and v is not None)
                if rows in (1,17,1000,10000):
                    saved=db.execute('SELECT breakdown,school_name FROM enrollment WHERE school_id=? AND year=?',(row['school_id'],f['year'])).fetchone()
                    assert json.loads(saved[0])==values
                    assert saved[1]==row['school_name'].strip()
        actual=db.execute('SELECT COUNT(*),SUM(total),SUM(male),SUM(female) FROM enrollment WHERE year=?',(f['year'],)).fetchone()
        assert actual==(rows,total,male,female),(f['file'],actual,(rows,total,male,female))
        for cols in LEVELS.values():
            agg=db.execute(f'SELECT SUM(n),SUM(t) FROM (SELECT COUNT(*) n,SUM(total) t FROM enrollment WHERE year=? GROUP BY {",".join(cols)})',(f['year'],)).fetchone()
            assert agg==(rows,total)
        print(f"Verified {f['file']}: {rows:,} keys; {total:,} counts; all geographic levels reconcile",flush=True)
    assert db.execute('PRAGMA integrity_check').fetchone()[0]=='ok'
    assert db.execute('SELECT COUNT(*) FROM (SELECT school_id,year,COUNT(*) n FROM enrollment GROUP BY school_id,year HAVING n>1)').fetchone()[0]==0
    db.close()

if __name__=='__main__':
    suite=unittest.defaultTestLoader.loadTestsFromTestCase(NormalizationTests)
    if not unittest.TextTestRunner().run(suite).wasSuccessful(): sys.exit(1)
    if len(sys.argv)>1: verify_sources(pathlib.Path(sys.argv[1]))
