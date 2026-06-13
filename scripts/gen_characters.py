#!/usr/bin/env python3
"""可續跑的角色素材 orchestrator：nano_banana_2 錨點 → AutoSprite idle/run/attack → 下載 → sprites.json。
已存在的檔案會跳過，可重複執行續跑。進度寫入 scripts/gen_progress.log。"""
import json, os, subprocess, sys, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HF = "/Users/wuqi/.hermes/node/bin/higgsfield"
SPRITES = os.path.join(ROOT, "public/assets/sprites")
RAW = os.path.join(SPRITES, "raw")
URLS = os.path.join(ROOT, "scripts/gen_urls.json")
os.makedirs(RAW, exist_ok=True)

STYLE = ("Full-body 2D game character sprite in the art style of Alien Hominid Invasion by The Behemoth: "
         "thick bold black ink outlines, flat cel-shaded coloring with hard shadow shapes, exaggerated cartoon "
         "proportions with slightly oversized head and large hands, hand-drawn Newgrounds flash aesthetic. ")
TAIL = (" Standing in a dynamic fighting stance, full body head to toe, facing right in a 3/4 side view, "
        "centered with margin, on a plain solid white background. Clean game asset, no text, no watermark.")

ROSTER = {
  "punk":      "Character: a cocky young Taiwanese street punk, casual open bomber jacket over a tank top, "
               "backwards baseball cap, ripped jeans, sneering troublemaker face.",
  "knifer":    "Character: a lean fast Taiwanese street thug gripping a small butterfly knife, head bandana, "
               "sleeveless shirt, a scar across one cheek, menacing grin.",
  "bruiser":   "Character: a huge muscular bald Taiwanese bouncer enforcer, tight black t-shirt straining over "
               "massive arms, thick neck, furious scowl, towering and heavy.",
  "thrower":   "Character: a scrappy Taiwanese betel-nut street tough winding up to throw a green glass beer "
               "bottle, untucked shirt, shorts and flip-flops, wild careless grin.",
  "bodyguard": "Character: a stern Taiwanese bodyguard in a black suit with an earpiece and black sunglasses, "
               "hands raised in a defensive guard, broad and disciplined.",
  "berserker": "Character: a wild-eyed shirtless Taiwanese gangster covered in colorful dragon tattoos, frenzied "
               "snarling expression, fists clenched, reckless and aggressive.",
  "boss_ximen":   "Character: a flashy Taiwanese gang boss, loud leopard-print silk shirt open at the chest, heavy "
                  "gold chains, slicked-back hair, smug arrogant grin, the leader of Ximending.",
  "boss_shilin":  "Character: a scar-faced wealthy Taiwanese crime boss wielding two butterfly knives, dark silk "
                  "shirt, gold rings, cruel confident sneer.",
  "boss_longshan":"Character: a giant topless Taiwanese temple-district enforcer with traditional full-body "
                  "tattoos, open vest, shaved head, immense and intimidating.",
  "boss_xinyi":   "Character: an elegant sinister Taiwanese gentleman villain in a sharp black three-piece suit, "
                  "holding a closed black umbrella like a cane, refined cold menace, slick dark hair.",
  "boss_101":     "Character: the final crime syndicate chairman, an immaculate pure white suit with a black shirt, "
                  "slicked silver hair, commanding ruthless expression, powerful and untouchable.",
}
ANIMS = ["idle", "run", "attack"]

def log(m):
    print(m, flush=True)
    with open(os.path.join(ROOT, "scripts/gen_progress.log"), "a") as f:
        f.write(m + "\n")

def run_json(args):
    r = subprocess.run([HF] + args, capture_output=True, text=True, timeout=400)
    out = r.stdout.strip()
    try:
        data = json.loads(out)
        if isinstance(data, list):
            return data[0].get("result_url")
        return data.get("result_url")
    except Exception:
        # 非 JSON：嘗試從輸出抓 https URL
        for tok in out.split():
            if tok.startswith("https://"):
                return tok
        log("  ! parse fail: " + (out[-200:] if out else r.stderr[-200:]))
        return None

def download(url, path):
    urllib.request.urlretrieve(url, path)

def load_urls():
    return json.load(open(URLS)) if os.path.exists(URLS) else {}

def save_urls(u):
    json.dump(u, open(URLS, "w"), ensure_ascii=False, indent=2)

def main():
    urls = load_urls()
    for cid, desc in ROSTER.items():
        # 1) 錨點
        anchor_png = os.path.join(RAW, f"{cid}_anchor.png")
        if cid not in urls or not os.path.exists(anchor_png):
            log(f"[{cid}] anchor generating...")
            u = run_json(["generate", "create", "nano_banana_2", "--prompt", STYLE + desc + TAIL,
                          "--aspect_ratio", "1:1", "--wait", "--json"])
            if not u:
                log(f"[{cid}] anchor FAILED, skip char"); continue
            urls[cid] = u; save_urls(urls)
            download(u, anchor_png)
            log(f"[{cid}] anchor ok")
        anchor_url = urls[cid]
        # 2) 動畫
        for kind in ANIMS:
            sheet = os.path.join(SPRITES, f"{cid}-{kind}.png")
            if os.path.exists(sheet):
                continue
            log(f"[{cid}] {kind} generating...")
            u = run_json(["generate", "create", "autosprite", "--image_url", anchor_url,
                          "--kind", kind, "--frame_count", "12", "--frame_size", "256",
                          "--video_tier", "turbo", "--remove_bg", "ultra", "--is_humanoid", "true",
                          "--wait", "--json"])
            if not u:
                log(f"[{cid}] {kind} FAILED"); continue
            download(u, sheet)
            log(f"[{cid}] {kind} ok")
    # 3) 重建 sprites.json（含 hero 與所有完成角色）
    build_sprites_json()
    log("ALL DONE")

CLIP_FPS = {"idle": (10, True), "run": (16, True), "attack": (28, False)}

def build_sprites_json():
    sj_path = os.path.join(SPRITES, "sprites.json")
    sj = json.load(open(sj_path)) if os.path.exists(sj_path) else {}
    # 確保 hero 在內（已手動寫過則保留）
    ids = ["hero"] + list(ROSTER.keys())
    for cid in ids:
        clips = {}
        amap = {"idle": "idle", "run": "run", "attack": "punch1"}
        for kind, clipbase in amap.items():
            src = f"{cid}-{kind}.png"
            if cid == "hero":
                src = {"idle": "hero-idle.png", "run": "hero-run.png", "attack": "hero-attack.png"}[kind]
            if not os.path.exists(os.path.join(SPRITES, src)):
                continue
            fps, loop = CLIP_FPS[kind]
            clips[clipbase] = {"src": src, "frames": 12, "fps": fps, "loop": loop,
                               "frameW": 256, "frameH": 256, "anchorX": 0.5, "anchorY": 0.94}
            if kind == "attack":  # heavy 借用 attack 表
                clips["heavy"] = dict(clips["punch1"], fps=22)
        if clips:
            sj[cid] = {"heightM": 2.3, "clips": clips}
    json.dump(sj, open(sj_path, "w"), ensure_ascii=False, indent=2)
    log(f"sprites.json rebuilt: {list(sj.keys())}")

if __name__ == "__main__":
    main()
