#!/usr/bin/env python3
"""場景寬幅 backdrop 生成：每主題一張 21:9 背景圖（Behemoth 風、無人物）→ scenes.json。
可續跑：已存在的檔案跳過。"""
import json, os, subprocess, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HF = "/Users/wuqi/.hermes/node/bin/higgsfield"
SCENES = os.path.join(ROOT, "public/assets/scenes")
os.makedirs(SCENES, exist_ok=True)

STYLE = ("Wide panoramic 2D side-scroller game background plate in the art style of Alien Hominid Invasion by "
         "The Behemoth: thick bold black ink outlines, flat cel-shaded coloring with hard shadow shapes, "
         "hand-drawn Newgrounds cartoon aesthetic, moody night lighting. Background scenery only — buildings, "
         "signage and sky — NO people, NO characters, NO foreground street floor. Seamless horizontal composition. ")

SCENES_DEF = {
  "neon":        ("ximen-bg.png", "Scene: the Ximending pedestrian district of Taipei at night, dense stacked glowing "
                  "neon shop signs with Chinese characters, the octagonal red-brick Ximen Red House building, movie-street "
                  "arcade signage, tangled overhead cables, a hazy purple-blue night sky."),
  "nightmarket": ("shilin-bg.png", "Scene: a Shilin night market alley in Taipei at night, rows of red paper lanterns "
                  "strung overhead, striped food-stall awnings with Chinese food signs, rising steam, warm glowing bulbs, "
                  "a deep orange-brown night sky."),
  "temple":      ("longshan-bg.png", "Scene: the Longshan Temple courtyard in Taipei at night, ornate swallowtail tiled "
                  "temple roofs with dragon ridge decorations, tall red lacquered pillars, rows of hanging red lanterns, "
                  "drifting incense smoke, a starry deep-purple night sky and a moon."),
  "skybridge":   ("xinyi-bg.png", "Scene: the Xinyi shopping district of Taipei at night, glossy glass curtain-wall "
                  "department stores, a white steel arch pedestrian skybridge, the glowing Taipei 101 tower rising in the "
                  "background, colorful neon billboards, a cool blue night sky."),
  "rooftop":     ("rooftop-bg.png", "Scene: the rooftop of Taipei 101 at night, a sea of distant city lights far below, "
                  "the tall antenna spire with a blinking red beacon, drifting clouds, a dramatic dark blue starry sky."),
}

def log(m):
    print(m, flush=True)
    with open(os.path.join(ROOT, "scripts/gen_scenes.log"), "a") as f:
        f.write(m + "\n")

def run_json(args):
    r = subprocess.run([HF] + args, capture_output=True, text=True, timeout=400)
    out = r.stdout.strip()
    try:
        d = json.loads(out)
        return (d[0] if isinstance(d, list) else d).get("result_url")
    except Exception:
        for tok in out.split():
            if tok.startswith("https://"):
                return tok
        log("  ! parse fail: " + (out[-200:] if out else r.stderr[-200:]))
        return None

def main():
    sj_path = os.path.join(SCENES, "scenes.json")
    sj = json.load(open(sj_path)) if os.path.exists(sj_path) else {}
    for theme, (fname, desc) in SCENES_DEF.items():
        path = os.path.join(SCENES, fname)
        if not os.path.exists(path):
            log(f"[{theme}] generating...")
            u = run_json(["generate", "create", "nano_banana_2", "--prompt", STYLE + desc,
                          "--aspect_ratio", "21:9", "--wait", "--json"])
            if not u:
                log(f"[{theme}] FAILED"); continue
            urllib.request.urlretrieve(u, path)
            log(f"[{theme}] ok")
        sj[theme] = {"backdrop": fname}
        json.dump(sj, open(sj_path, "w"), ensure_ascii=False, indent=2)
    log("SCENES DONE")

if __name__ == "__main__":
    main()
