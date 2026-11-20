#!/usr/bin/env python3
"""Extend the six-mode FINKE Sudoku APK with an independent playable Blocks mode."""
import os
import re
import struct
import zipfile
from pathlib import Path

SOURCE = Path(os.environ.get("FINKE_SOURCE", "downloads/FINKE-Sudoku-v3.0-six-levels.apk"))
DEST = Path(os.environ.get("FINKE_UNSIGNED", "downloads/FINKE-Sudoku-v4.0-blocks-unsigned.apk"))
MOD = Path(".github/sudoku-v4")
DEST.parent.mkdir(parents=True, exist_ok=True)

def must_replace(src, old, new, description):
    count = src.count(old)
    if count != 1:
        raise AssertionError(f"{description}: expected exactly once, found {count}")
    return src.replace(old,new,1)

def u16(data, offset):
    return struct.unpack_from("<H",data,offset)[0]

def u32(data, offset):
    return struct.unpack_from("<I",data,offset)[0]

def strings_in(data, pos):
    count=u32(data,pos+8)
    flags=u32(data,pos+16)
    first=pos+u32(data,pos+20)
    result=[]
    for n in range(count):
        v=first+u32(data,pos+28+n*4)
        if flags&256:
            a=data[v];v+=2 if a&128 else 1
            b=data[v];num=((b&127)<<8)+data[v+1] if b&128 else b;v+=2 if b&128 else 1
            result.append(bytes(data[v:v+num]).decode('utf-8'))
        else:
            a=u16(data,v)
            if a&32768:
                num=((a&32767)<<16)+u16(data,v+2)
                v+=4
            else:
                num=a;v+=2
            result.append(bytes(data[v:v+num*2]).decode('utf-16-le'))
    return result

def manifest_v4(raw):
    data=bytearray(raw)
    if u16(data,0)!=3:
        raise AssertionError("Not a compiled Android manifest")
    strings=None
    found={}
    pos=u16(data,2)
    while pos<len(data):
        kind=u16(data,pos)
        length=u32(data,pos+4)
        if length<8 or pos+length>len(data):
            raise AssertionError("Invalid binary manifest")
        if kind==1:strings=strings_in(data,pos)
        if kind==0x102:
            assert strings is not None
            for i in range(u16(data,pos+28)):
                a=pos+16+u16(data,pos+24)+i*u16(data,pos+26)
                key=strings[u32(data,a+4)]
                kind_data=data[a+15]
                num=u32(data,a+16)
                if key=="versionCode":
                    assert kind_data==16 and num==4, (key,num)
                    struct.pack_into("<I",data,a+16,5)
                    found[key]=(4,5)
                if key=="versionName":
                    assert kind_data==3 and strings[num]=="3.0", (key,num,strings[num])
                    found[key]=("3.0","4.0")
                if key=="minSdkVersion":
                    assert kind_data==16 and num==21
                    found[key]=21
        pos+=length
    assert set(found)=={"versionCode","versionName","minSdkVersion"},found
    utf8=b"3.0"
    utf16="3.0".encode("utf-16-le")
    if data.count(utf8)==1:
        data=data.replace(utf8,b"4.0",1)
    elif data.count(utf16)==1:
        data=data.replace(utf16,"4.0".encode("utf-16-le"),1)
    else:raise AssertionError("Cannot patch versionName without size change")
    return bytes(data)

BLOCKS_BUTTON = """
  <button id="openBlocks" class="blocks-launch" aria-label="Новая игра Блоки, собирай линии и квадраты">
   <span class="blocks-launch-icon" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></span>
   <span class="blocks-launch-copy"><strong>НОВАЯ ИГРА: БЛОКИ</strong><small>Собери ряд, столбец или квадрат 3 × 3</small></span>
   <span class="blocks-launch-arrow" aria-hidden="true">›</span>
  </button>
"""

BLOCKS_SCREEN = """
<section id="blocksGame" class="screen blocks-screen hidden">
 <header class="blocks-header">
  <button id="blocksExit" class="blocks-back" aria-label="Вернуться в главное меню">‹</button>
  <div class="blocks-title"><strong>Блоки</strong><small>Собирай линии и квадраты</small></div>
  <button id="blocksModal" class="blocks-help-top" aria-label="Объяснить правила">?</button>
 </header>
 <div class="blocks-body">
  <div class="blocks-stats">
   <div class="blocks-stat"><small>ОЧКИ</small><strong id="blocksScore">0</strong></div>
   <div class="blocks-stat"><small>РЕКОРД</small><strong id="blocksBest">0</strong></div>
   <div class="blocks-stat"><small>ХОДЫ</small><strong id="blocksMoves">0</strong></div>
  </div>
  <p class="blocks-instruction">Нажми на фигуру внизу, затем на свободное место.</p>
  <div id="blocksBoard" class="blocks-board" role="grid" aria-label="Поле для блоков 9 на 9"></div>
  <div class="blocks-feedback" id="blocksMessage" aria-live="polite">Выбери фигуру и коснись поля.</div>
  <h2 class="blocks-pieces-label">Твои фигуры</h2>
  <div id="blocksTray" class="blocks-tray" role="group" aria-label="Три фигуры для выбора"></div>
  <div class="blocks-actions">
   <button id="blocksHelp" class="blocks-how">Как играть?</button>
   <button id="blocksRestart" class="blocks-new">Новая игра</button>
  </div>
  <p class="blocks-note">Заполни весь ряд, столбец или квадрат 3 × 3, чтобы он исчез!</p>
 </div>
</section>
"""

with zipfile.ZipFile(SOURCE) as apk:
    assert apk.testzip() is None, "Corrupt base APK"
    all_names=set(apk.namelist())
    assert {"AndroidManifest.xml","classes.dex","assets/game.js","assets/index.html","assets/luxury.css"}.issubset(all_names)
    html=apk.read("assets/index.html").decode("utf-8")
    html=must_replace(html, '<link rel="stylesheet" href="./luxury.css">',
        '<link rel="stylesheet" href="./luxury.css">\n<link rel="stylesheet" href="./blocks.css">',
        "Blocks styling")
    html=must_replace(html,'  <nav class="menu-actions" aria-label="Другие действия">',
        BLOCKS_BUTTON+'  <nav class="menu-actions" aria-label="Другие действия">',
        "Blocks launch button")
    html=must_replace(html,'<div id="modal" class="modal-layer hidden"',
        BLOCKS_SCREEN+'<div id="modal" class="modal-layer hidden"',
        "Blocks game screen")
    html=must_replace(html,'<script src="./game.js"></script></body></html>',
        '<script src="./game.js"></script><script src="./blocks.js"></script></body></html>',
        "Blocks logic entry")
    assert html.count("data-level=")==6, "All six classic Sudoku levels must remain"
    css=(MOD/"blocks.css").read_bytes()
    js=(MOD/"blocks.js").read_bytes()
    assert b"resolvePlacement" in js and b"canContinue" in js

    replacements={
      "AndroidManifest.xml":manifest_v4(apk.read("AndroidManifest.xml")),
      "assets/index.html":html.encode("utf-8"),
      "assets/blocks.js":js,
      "assets/blocks.css":css,
    }
    # Original game code and all its progress storage keys are deliberately unchanged.
    assert "assets/game.js" not in replacements
    with zipfile.ZipFile(DEST,"w") as output:
        for info in apk.infolist():
            if info.filename.startswith("META-INF/"):
                continue
            output.writestr(info,replacements.pop(info.filename,apk.read(info.filename)),compress_type=info.compress_type)
        for name,content in replacements.items():
            assert name.startswith("assets/"),"Cannot add undeclared resources"
            output.writestr(name,content,compress_type=zipfile.ZIP_DEFLATED)

with zipfile.ZipFile(DEST) as result:
    assert result.testzip() is None,"Output APK ZIP invalid"
    entries=set(result.namelist())
    assert {"AndroidManifest.xml","classes.dex","assets/game.js","assets/index.html","assets/blocks.js","assets/blocks.css"}.issubset(entries)
    assert result.read("assets/game.js")==zipfile.ZipFile(SOURCE).read("assets/game.js"),"Old sudoku engine changed"
    text=result.read("assets/index.html").decode("utf-8")
    assert text.count("data-level=")==6
    assert text.count('id="openBlocks"')==1 and text.count('id="blocksBoard"')==1
    print("VERIFIED: original six sudoku levels preserved")
    print("VERIFIED: new Blocks entry, board and scripts present")
    print("UNSIGNED:",str(DEST),DEST.stat().st_size,"bytes")
