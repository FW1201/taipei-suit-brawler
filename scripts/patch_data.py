import json, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

ep = os.path.join(ROOT, 'src/data/enemies.json')
E = json.load(open(ep))
arm = {'bodyguard': 40, 'bruiser': 25, 'boss_longshan': 60, 'boss_xinyi': 50, 'boss_101': 80}
for e in E:
    if e['id'] in arm:
        e['armor'] = arm[e['id']]
    if e['id'] in ('boss_xinyi', 'boss_101'):
        e['rangedEvery'] = 3.2 if e['id'] == 'boss_xinyi' else 2.6
json.dump(E, open(ep, 'w'), ensure_ascii=False, indent=2)

lp = os.path.join(ROOT, 'src/data/levels.json')
L = json.load(open(lp))
propmap = {
    1: [['crate'], ['football', 'crate'], ['explosive', 'barrier']],
    2: [['crate', 'football'], ['explosive'], ['barrier', 'explosive'], ['football']],
    3: [['barrier', 'crate'], ['explosive', 'mower'], ['explosive', 'barrier']],
    4: [['barrier', 'crate'], ['explosive', 'football'], ['barrier', 'explosive'], ['mower', 'explosive']],
    5: [['barrier', 'explosive'], ['crate', 'football'], ['explosive', 'barrier', 'mower'], ['explosive', 'explosive']],
}
for lv in L:
    pl = propmap.get(lv['id'], [])
    for i, w in enumerate(lv['waves']):
        if i < len(pl):
            w['props'] = pl[i]
json.dump(L, open(lp, 'w'), ensure_ascii=False, indent=2)
print('enemies+levels updated')
