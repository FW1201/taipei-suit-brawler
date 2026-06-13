#!/usr/bin/env python3
"""補充素材：① 主角互動動作 sprite（throw/carry，優先）② 互動物件 AI 圖（綠底去背用）。
可續跑，已存在檔案跳過。進度寫入 scripts/gen_progress.log。"""
import json, os, subprocess, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HF = "/Users/wuqi/.hermes/node/bin/higgsfield"
SPRITES = os.path.join(ROOT, "public/assets/sprites")
PROPS = os.path.join(ROOT, "public/assets/props")
URLS = os.path.join(ROOT, "scripts/gen_urls.json")
os.makedirs(PROPS, exist_ok=True)

def log(m):
    print(m, flush=True)
    with open(os.path.join(ROOT, "scripts/gen_progress.log"), "a") as f:
        f.write(m + "\n")

def run_url(args):
    r = subprocess.run([HF] + args, capture_output=True, text=True, timeout=420)
    out = r.stdout.strip()
    try:
        data = json.loads(out)
        return (data[0] if isinstance(data, list) else data).get("result_url")
    except Exception:
        for tok in out.split():
            if tok.startswith("https://"):
                return tok
        log("  ! parse fail: " + (out[-200:] if out else r.stderr[-200:]))
        return None

def dl(url, path):
    urllib.request.urlretrieve(url, path)

# ── 主角互動動作（AutoSprite custom，掛 hero 錨點）──
HERO_ANIMS = {
    "throw": "character winds up and hurls a heavy object forward with both hands, overhand throwing motion",
    "carry": "character holds a heavy object up with both hands in front of chest, bracing and walking",
}

def upload_local(path):
    """上傳本機圖檔，回傳 upload id（供 --image_url 使用）"""
    r = subprocess.run([HF, "upload", "create", path, "--json"], capture_output=True, text=True, timeout=180)
    out = r.stdout.strip()
    try:
        data = json.loads(out)
        d = data[0] if isinstance(data, list) else data
        return d.get("id") or d.get("upload_id") or d.get("uuid")
    except Exception:
        for tok in out.split():
            if len(tok) >= 32 and tok.count("-") >= 4:
                return tok
        log("  ! upload parse fail: " + (out[-200:] if out else r.stderr[-200:]))
        return None

def gen_hero():
    urls = json.load(open(URLS)) if os.path.exists(URLS) else {}
    hero_url = urls.get("hero")
    if not hero_url:
        anchor = os.path.join(SPRITES, "raw/hero_anchor.png")
        if os.path.exists(anchor):
            log("[hero] uploading local anchor...")
            hero_url = upload_local(anchor)
            if hero_url:
                urls["hero"] = hero_url
                json.dump(urls, open(URLS, "w"), ensure_ascii=False, indent=2)
                log("[hero] anchor uploaded: " + str(hero_url)[:40])
    if not hero_url:
        log("[hero-extra] no hero anchor url/upload, skip"); return
    for kind, prompt in HERO_ANIMS.items():
        out = os.path.join(SPRITES, f"hero-{kind}.png")
        if os.path.exists(out):
            continue
        log(f"[hero] {kind} generating...")
        u = run_url(["generate", "create", "autosprite", "--image_url", hero_url,
                     "--kind", "custom", "--name", kind, "--prompt", prompt,
                     "--frame_count", "12", "--frame_size", "256", "--video_tier", "turbo",
                     "--remove_bg", "ultra", "--is_humanoid", "true", "--wait", "--json"])
        if u:
            dl(u, out); log(f"[hero] {kind} ok")
        else:
            log(f"[hero] {kind} FAILED")

# ── 互動物件 AI 圖（純綠底，載入時去背）──
OBJ_STYLE = ("single centered video-game item asset in the art style of Alien Hominid Invasion by The Behemoth: "
             "thick bold black ink outline, flat cel-shaded coloring with hard shadow shapes, hand-drawn cartoon. ")
OBJ_TAIL = (" The object fills most of the frame, centered, on a solid flat pure chroma-key green background "
            "(#00ff00), no ground shadow, no text, no watermark.")
OBJECTS = {
    "football": "a classic black-and-white soccer ball (football)",
    "explosive": "a red liquefied-petroleum-gas propane canister tank with a yellow hazard label and metal valve on top, Taiwan street-stall style",
    "mower": "a red push lawn mower with a round cutting deck and a spinning blade, three-quarter side view",
    "crate": "a sturdy wooden shipping crate box with plank seams and diagonal braces",
    "barrier": "a yellow and black diagonally striped road construction A-frame barricade barrier",
}

def gen_objects():
    for kind, desc in OBJECTS.items():
        out = os.path.join(PROPS, f"{kind}.png")
        if os.path.exists(out):
            continue
        log(f"[prop] {kind} generating...")
        u = run_url(["generate", "create", "nano_banana_2", "--prompt", OBJ_STYLE + desc + OBJ_TAIL,
                     "--aspect_ratio", "1:1", "--wait", "--json"])
        if u:
            dl(u, out); log(f"[prop] {kind} ok")
        else:
            log(f"[prop] {kind} FAILED")

def patch_sprites_json():
    sj_path = os.path.join(SPRITES, "sprites.json")
    sj = json.load(open(sj_path))
    hero = sj.get("hero")
    if not hero:
        return
    add = {"throw": (24, False), "carry": (10, True)}
    for kind, (fps, loop) in add.items():
        src = f"hero-{kind}.png"
        if os.path.exists(os.path.join(SPRITES, src)):
            hero["clips"][kind] = {"src": src, "frames": 12, "fps": fps, "loop": loop,
                                   "frameW": 256, "frameH": 256, "anchorX": 0.5, "anchorY": 0.94}
    json.dump(sj, open(sj_path, "w"), ensure_ascii=False, indent=2)
    log("sprites.json patched (hero throw/carry)")

if __name__ == "__main__":
    gen_hero()
    gen_objects()
    patch_sprites_json()
    log("EXTRAS DONE")
