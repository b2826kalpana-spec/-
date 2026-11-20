#!/usr/bin/env python3
"""FINKE Sudoku: restore six clearly labeled difficulty levels in the existing APK."""
from pathlib import Path
import os
import re
import struct
import zipfile

SOURCE = Path(os.environ.get("SUDOKU_SOURCE", "downloads/FINKE-Sudoku-v2.1-compatible.apk"))
OUTPUT = Path(os.environ.get("SUDOKU_OUTPUT", "downloads/FINKE-Sudoku-v3.0-six-levels-unsigned.apk"))
OUTPUT.parent.mkdir(parents=True, exist_ok=True)

def replace_one(src: str, old: str, new: str, label: str) -> str:
    count = src.count(old)
    if count != 1:
        raise ValueError(f"{label}: expected one original occurrence, found {count}")
    return src.replace(old, new, 1)

def u16(data: bytearray, offset: int) -> int:
    return struct.unpack_from("<H", data, offset)[0]

def u32(data: bytearray, offset: int) -> int:
    return struct.unpack_from("<I", data, offset)[0]

def string_table(data: bytearray, start: int) -> list[str]:
    count = u32(data, start + 8)
    flags = u32(data, start + 16)
    string_base = start + u32(data, start + 20)
    results = []
    for i in range(count):
        pos = string_base + u32(data, start + 28 + i * 4)
        if flags & 256:
            a = data[pos]
            pos += 2 if a & 128 else 1
            b = data[pos]
            chars = ((b & 127) << 8) + data[pos + 1] if b & 128 else b
            pos += 2 if b & 128 else 1
            results.append(bytes(data[pos:pos + chars]).decode("utf-8"))
        else:
            n = u16(data, pos)
            pos += 4 if n & 32768 else 2
            chars = (((n & 32767) << 16) + u16(data, pos - 2)) if n & 32768 else n
            results.append(bytes(data[pos:pos + chars * 2]).decode("utf-16-le"))
    return results

def change_manifest(original: bytes) -> bytes:
    data = bytearray(original)
    if u16(data, 0) != 3:
        raise ValueError("Expected Android binary XML")
    strings = None
    seen = {}
    offset = u16(data, 2)
    while offset < len(data):
        if offset + 8 > len(data):
            raise ValueError("Truncated binary XML chunk")
        kind = u16(data, offset)
        size = u32(data, offset + 4)
        if size < 8 or offset + size > len(data):
            raise ValueError("Invalid Android binary XML chunk")
        if kind == 1:
            strings = string_table(data, offset)
        if kind == 0x102:
            assert strings is not None
            for k in range(u16(data, offset + 28)):
                pos = offset + 16 + u16(data, offset + 24) + k * u16(data, offset + 26)
                name = strings[u32(data, pos + 4)]
                dtype = data[pos + 15]
                value = u32(data, pos + 16)
                if name == "versionCode":
                    if dtype != 16 or value != 3:
                        raise ValueError(f"Unexpected versionCode {value}")
                    struct.pack_into("<I", data, pos + 16, 4)
                    seen["versionCode"] = 4
                if name == "minSdkVersion":
                    if dtype != 16 or value != 21:
                        raise ValueError(f"Unexpected minSdkVersion {value}")
                    seen["minSdkVersion"] = 21
                if name == "versionName":
                    if dtype != 3 or strings[value] != "2.0":
                        raise ValueError("Unexpected versionName")
                    seen["versionName"] = "2.0"
        offset += size
    if set(seen) != {"versionCode", "versionName", "minSdkVersion"}:
        raise ValueError(f"Manifest values incomplete: {seen}")
    utf8_name = b"2.0"
    utf16_name = "2.0".encode("utf-16-le")
    if data.count(utf8_name) == 1:
        data = data.replace(utf8_name, b"3.0", 1)
    elif data.count(utf16_name) == 1:
        data = data.replace(utf16_name, "3.0".encode("utf-16-le"), 1)
    else:
        raise ValueError("Unexpected binary XML version name encoding")
    return bytes(data)

with zipfile.ZipFile(SOURCE) as source:
    if source.testzip() is not None:
        raise ValueError("Original APK failed ZIP integrity test")
    expected = {"AndroidManifest.xml", "classes.dex", "assets/game.js", "assets/index.html", "assets/luxury.css"}
    if not expected.issubset(set(source.namelist())):
        raise ValueError("Missing original game assets")

    game = source.read("assets/game.js").decode("utf-8")
    game = replace_one(game,
        "const LEVELS={easy:{name:'Лёгкий',clues:46},medium:{name:'Средний',clues:38},hard:{name:'Сложный',clues:32},expert:{name:'Эксперт',clues:27}};",
        "const LEVELS={beginner:{name:'Новичок',clues:54},easy:{name:'Лёгкий',clues:46},medium:{name:'Средний',clues:38},hard:{name:'Сложный',clues:32},expert:{name:'Эксперт',clues:28},master:{name:'Мастер',clues:24}};",
        "Six actual puzzle difficulties")
    game = replace_one(game,
        "for(let attempt=0;attempt<(level==='expert'?3:2);attempt++){",
        "for(let attempt=0;attempt<(level==='master'?9:level==='expert'?4:2);attempt++){",
        "Harder puzzle generation")
    game = replace_one(game,
        "levelWins:{easy:0,medium:0,hard:0,expert:0}",
        "levelWins:{beginner:0,easy:0,medium:0,hard:0,expert:0,master:0}",
        "Six difficulty statistics")
    game = replace_one(game,
        "selectedLevel='easy';",
        "selectedLevel='beginner';",
        "Beginner as default selection")

    html = source.read("assets/index.html").decode("utf-8")
    easy = '<button class="level level-easy chosen" data-level="easy" aria-pressed="true">'
    html = replace_one(html, easy,
        '<button class="level level-beginner chosen" data-level="beginner" aria-pressed="true"><span class="level-art">☀</span><strong class="level-label">Новичок</strong></button>\n    ' +
        '<button class="level level-easy" data-level="easy" aria-pressed="false">',
        "Beginner level tile")
    expert = '<button class="level level-expert" data-level="expert" aria-pressed="false"><span class="level-art">♛</span><strong class="level-label">Эксперт</strong></button>'
    html = replace_one(html, expert,
        expert + '\n    <button class="level level-master" data-level="master" aria-pressed="false"><span class="level-art">✦</span><strong class="level-label">Мастер</strong></button>',
        "Master level tile")
    html = replace_one(html, "Сейчас выбран лёгкий уровень", "Сейчас выбран уровень «Новичок»", "Accessible selection hint")

    css = source.read("assets/luxury.css").decode("utf-8")
    css += """
/* 3×2 grid: all SIX true game levels visible together, minimum 70px touch height */
.home .level-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}
.home .level{height:76px;min-height:76px;border-radius:16px;justify-content:center;padding:8px 3px}
.home .level-label{font-size:clamp(12px,3.5vw,15px);letter-spacing:-.02em;white-space:nowrap}
.home .level .level-art{font-size:17px;margin-bottom:4px}
.home .level-beginner{background:linear-gradient(#f3ffe7,#c6f9a5);border-color:#8adb70}
.home .level-beginner .level-art{color:#239e2c}
.home .level-master{background:linear-gradient(#fff8da,#ffd477);border-color:#f0b536}
.home .level-master .level-art{color:#ad6800;font-size:22px}
.home .level-master .level-label{color:#683e00}
.home .hero{min-height:111px}
.home .hero h1{font-size:29px}
.home .start-panel{padding:13px 13px 11px}
.home .start-button{min-height:70px;margin-top:13px}
@media(max-width:360px){
 .home .level-grid{gap:6px}
 .home .level{height:72px;min-height:72px;padding:5px 1px}
 .home .level-label{font-size:12px}
 .home .hero{min-height:101px}
 .home .start-button{font-size:20px}
}
"""

    replacements = {
        "AndroidManifest.xml": change_manifest(source.read("AndroidManifest.xml")),
        "assets/game.js": game.encode("utf-8"),
        "assets/index.html": html.encode("utf-8"),
        "assets/luxury.css": css.encode("utf-8"),
    }
    with zipfile.ZipFile(OUTPUT, "w") as target:
        for item in source.infolist():
            if item.filename.startswith("META-INF/"):
                continue
            target.writestr(item, replacements.get(item.filename, source.read(item.filename)), compress_type=item.compress_type)

with zipfile.ZipFile(OUTPUT) as result:
    if result.testzip() is not None:
        raise ValueError("New APK failed ZIP integrity test")
    final_html = result.read("assets/index.html").decode("utf-8")
    names = re.findall(r'data-level="([a-z]+)"', final_html)
    if names != ["beginner", "easy", "medium", "hard", "expert", "master"]:
        raise ValueError(f"Expected six ordered difficulty buttons: {names}")
    print("VERIFIED: six selectable modes", names)
    print("UNSIGNED APK:", OUTPUT, OUTPUT.stat().st_size, "bytes")

# Testable source extracted before Android signing.
Path("finke-game-tested.js").write_text(game, encoding="utf-8")
