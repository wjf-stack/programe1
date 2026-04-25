from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import PP_ALIGN

OUT = r"d:\cursor\cursor_programe1\zhilianweiji\智联微记_网页插件主题_视觉升级版.pptx"

BLUE = RGBColor(47, 107, 255)
BLUE_D = RGBColor(21, 56, 150)
BLUE_L = RGBColor(120, 165, 255)
WHITE = RGBColor(255, 255, 255)
BG = RGBColor(243, 247, 255)
TEXT = RGBColor(17, 34, 72)
MUTED = RGBColor(93, 112, 150)
LINE = RGBColor(215, 227, 249)
C_ACC = RGBColor(98, 144, 255)

prs = Presentation()
prs.slide_width = Inches(13.333)
prs.slide_height = Inches(7.5)


def rect(slide, x, y, w, h, color, line=None, r=False):
    shp = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE if r else MSO_SHAPE.RECTANGLE, Inches(x), Inches(y), Inches(w), Inches(h))
    shp.fill.solid(); shp.fill.fore_color.rgb = color
    if line is None:
        shp.line.fill.background()
    else:
        shp.line.color.rgb = line
    return shp


def txt(slide, x, y, w, h, content, size=14, bold=False, color=TEXT, align=PP_ALIGN.LEFT):
    t = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    p = t.text_frame.paragraphs[0]
    p.text = content
    p.font.size = Pt(size)
    p.font.bold = bold
    p.font.color.rgb = color
    p.alignment = align
    return t


def bullets(slide, x, y, w, title, items):
    c = rect(slide, x, y, w, 2.6 + 0.42 * len(items), WHITE, LINE, True)
    txt(slide, x + 0.2, y + 0.14, w - 0.4, 0.4, title, 16, True, BLUE_D)
    box = slide.shapes.add_textbox(Inches(x + 0.2), Inches(y + 0.58), Inches(w - 0.4), Inches(2.1 + 0.42 * len(items)))
    tf = box.text_frame
    tf.word_wrap = True
    first = True
    for it in items:
        p = tf.paragraphs[0] if first else tf.add_paragraph(); first = False
        p.text = f"• {it}"
        p.font.size = Pt(12)
        p.font.color.rgb = TEXT


# Slide 1 - Hero with layered shapes
s = prs.slides.add_slide(prs.slide_layouts[6])
rect(s, 0, 0, 13.333, 7.5, BG)
rect(s, 0, 0, 13.333, 0.46, WHITE)
rect(s, 0, 0, 3.6, 0.08, BLUE)
for i in range(5):
    r = rect(s, 8.0 + i*0.35, 1.15 + i*0.2, 3.6 - i*0.45, 4.8 - i*0.42, BLUE_L if i % 2 else WHITE, LINE, True)
    r.fill.transparency = 0.75 if i else 0.0
txt(s, 0.52, 0.12, 6.5, 0.24, "智联微记｜网页插件主题展示", 13, True, BLUE_D)
txt(s, 9.8, 0.12, 2.9, 0.24, "视觉升级版", 10.5, False, MUTED, PP_ALIGN.RIGHT)
txt(s, 0.8, 1.2, 6.8, 1.2, "网页信息\n一键沉淀为知识网络", 42, True, TEXT)
txt(s, 0.85, 3.05, 6.8, 1.0, "插件快速采集 + 仪表盘管理 + 图谱复盘\n简约科技风，突出专业与效率", 16, False, MUTED)
for i, t in enumerate(["开始截图摘录", "打开知识图谱", "打开仪表盘"]):
    b = rect(s, 8.45, 2.2 + i * 0.98, 3.45, 0.72, BLUE if i != 1 else RGBColor(75, 128, 255), None, True)
    txt(s, 8.45, 2.37 + i * 0.98, 3.45, 0.32, t, 16, True, WHITE, PP_ALIGN.CENTER)
for i, (n, l) in enumerate([("3端", "插件/前端/后端"), ("4步", "采集→整理→关联→复用"), ("3层", "主题→分支→知识点")]):
    rect(s, 0.85 + i*2.35, 5.5, 2.15, 1.02, WHITE, LINE, True)
    txt(s, 1.02 + i*2.35, 5.62, 1.8, 0.34, n, 24, True, BLUE_D)
    txt(s, 1.02 + i*2.35, 5.98, 1.9, 0.34, l, 10.5, False, MUTED)

# Slide 2 - Zigzag feature page
s = prs.slides.add_slide(prs.slide_layouts[6])
rect(s, 0, 0, 13.333, 7.5, WHITE)
rect(s, 0, 0, 13.333, 0.5, BG)
rect(s, 0, 0.48, 13.333, 0.05, BLUE_L)
txt(s, 0.55, 0.14, 8, 0.24, "功能全景｜Feature Panorama", 13, True, BLUE_D)
txt(s, 0.8, 0.86, 8, 0.6, "插件到系统的完整能力链", 30, True)
# zigzag blocks
bullets(s, 0.8, 1.8, 5.9, "插件侧", ["截图选区摘录", "主题/分支必填", "保存状态反馈", "一键跳转图谱与仪表盘"])
bullets(s, 6.6, 2.45, 5.9, "仪表盘侧", ["笔记管理、搜索、删除", "编辑页支持图片粘贴上传", "主题标签维护与复用", "快捷回流知识图谱"])
bullets(s, 0.8, 4.55, 5.9, "图谱侧", ["多星系分簇布局", "主题/分支双筛选", "同分支聚焦节点", "节点详情与关联展开"])

# Slide 3 - Timeline style
s = prs.slides.add_slide(prs.slide_layouts[6])
rect(s, 0, 0, 13.333, 7.5, BG)
txt(s, 0.8, 0.7, 8, 0.8, "操作流程｜从采集到复盘", 32, True)
# timeline line
rect(s, 1.0, 3.1, 11.2, 0.08, BLUE_L)
steps = [
    (1.0, "01", "打开插件", "进入截图摘录模式"),
    (3.8, "02", "结构化录入", "填写主题与分支"),
    (6.6, "03", "仪表盘管理", "编辑/删除/检索"),
    (9.4, "04", "图谱复盘", "筛选并查看关联")
]
for x, no, t, d in steps:
    c = rect(s, x, 2.55, 2.5, 1.2, WHITE, LINE, True)
    txt(s, x+0.15, 2.68, 0.45, 0.3, no, 14, True, BLUE)
    txt(s, x+0.7, 2.66, 1.65, 0.3, t, 14, True, BLUE_D)
    txt(s, x+0.7, 3.02, 1.65, 0.3, d, 10.8, False, MUTED)
    n = rect(s, x+1.1, 3.85, 0.3, 0.3, BLUE, None, True)
    n.fill.transparency = 0.1
for i, label in enumerate(["插件弹窗截图", "摘录浮层截图", "图谱筛选截图"]):
    rect(s, 0.95 + i*4.15, 4.55, 3.75, 2.15, WHITE, LINE, True)
    txt(s, 1.1 + i*4.15, 5.45, 3.45, 0.5, label, 13, False, MUTED, PP_ALIGN.CENTER)

# Slide 4 - Dashboard metrics style
s = prs.slides.add_slide(prs.slide_layouts[6])
rect(s, 0, 0, 13.333, 7.5, WHITE)
rect(s, 0, 0, 13.333, 1.6, BG)
txt(s, 0.85, 0.55, 8, 0.5, "成果视图｜Dashboard Snapshot", 30, True)
txt(s, 0.86, 1.12, 10, 0.35, "以可视化指标呈现项目完成度与演示价值", 13, False, MUTED)
# metric tiles
for i,(n,l) in enumerate([("92%","功能完整度"),("90%","视觉表现"),("88%","交互体验"),("85%","稳定性")]):
    rect(s, 0.85+i*3.15, 2.0, 2.9, 1.4, WHITE, LINE, True)
    txt(s, 1.1+i*3.15, 2.3, 2.2, 0.4, n, 30, True, BLUE_D)
    txt(s, 1.1+i*3.15, 2.82, 2.2, 0.3, l, 12, False, MUTED)
# bars
labels=[("插件可用性",89),("图谱可读性",91),("结构化程度",93),("演示完成度",95)]
for i,(lb,v) in enumerate(labels):
    y=4.0+i*0.7
    txt(s,0.95,y,2.2,0.24,lb,12,False,MUTED)
    rect(s,2.8,y+0.02,6.8,0.2,RGBColor(233,239,251),None,True)
    rect(s,2.8,y+0.02,6.8*(v/100),0.2,C_ACC,None,True)
    txt(s,9.75,y,0.8,0.24,f"{v}%",12,True,BLUE_D)

# Slide 5 - Dark tech architecture
s = prs.slides.add_slide(prs.slide_layouts[6])
rect(s, 0, 0, 13.333, 7.5, BLUE_D)
for i in range(7):
    l = rect(s, 0.8+i*1.8, 0.2, 0.02, 7.1, BLUE_L)
    l.fill.transparency = 0.85
for i in range(4):
    l = rect(s, 0.3, 1.0+i*1.5, 12.7, 0.02, BLUE_L)
    l.fill.transparency = 0.87
txt(s,0.7,0.6,10,0.5,"技术架构｜Architecture",30,True,WHITE)
# glass cards
def dark_card(x,y,w,h,t,items):
    c=rect(s,x,y,w,h,RGBColor(34,76,180),BLUE_L,True); c.fill.transparency=0.2
    txt(s,x+0.2,y+0.12,w-0.4,0.3,t,15,True,WHITE)
    b=s.shapes.add_textbox(Inches(x+0.2),Inches(y+0.48),Inches(w-0.4),Inches(h-0.6))
    tf=b.text_frame
    for j,it in enumerate(items):
        p=tf.paragraphs[0] if j==0 else tf.add_paragraph(); p.text=f"• {it}"; p.font.size=Pt(11.5); p.font.color.rgb=WHITE

dark_card(0.8,1.5,3.9,4.9,"插件层",["Manifest V3","Popup + Content + SW","消息协议统一"])
dark_card(4.9,1.5,3.9,4.9,"前端层",["Vue3 + Vite + Pinia","Dashboard / Graph / Editor","权限路由守卫"])
dark_card(9.0,1.5,3.5,4.9,"后端层",["Express REST API","JWT 鉴权","LowDB + Multer"])

# Slide 6 - Graph spotlight
s = prs.slides.add_slide(prs.slide_layouts[6])
rect(s,0,0,13.333,7.5,BG)
txt(s,0.8,0.7,10,0.5,"知识图谱亮点｜Graph Spotlight",30,True)
# concentric circles
for i,r in enumerate([4.8,3.7,2.6,1.5]):
    c=rect(s,7.0-r/2,1.35+r*0.02,r,r,WHITE,RGBColor(170,196,248),True)
    c.fill.transparency=0.92 if i else 0.85
txt(s,7.05,3.05,2.4,0.3,"主题恒星",13,True,BLUE_D,PP_ALIGN.CENTER)
txt(s,6.85,3.35,2.8,0.3,"分支轨道 · 知识行星",11,False,MUTED,PP_ALIGN.CENTER)
bullets(s,0.8,1.7,5.5,"可视化优势",["多星系分簇，减少节点拥挤","主题与分支双维筛选","点击节点查看内容摘要与图片","同分支聚焦辅助复盘"])
bullets(s,0.8,4.5,5.5,"交互体验",["双击聚焦、重置视角","节点高亮与关系线弱化","适合课堂演示与答辩讲解"])

# Slide 7 - Comparison
s = prs.slides.add_slide(prs.slide_layouts[6])
rect(s,0,0,13.333,7.5,WHITE)
txt(s,0.8,0.7,10,0.5,"改进前后对比｜Before vs After",30,True)
rect(s,0.8,1.6,5.9,5.5,RGBColor(250,252,255),LINE,True)
rect(s,6.7,1.6,5.9,5.5,RGBColor(241,247,255),LINE,True)
txt(s,1.0,1.9,5.5,0.4,"传统记录方式（Before）",18,True,RGBColor(126,136,155))
txt(s,6.9,1.9,5.5,0.4,"智联微记方案（After）",18,True,BLUE_D)
left=["截图散落在本地文件夹","收藏夹堆积难检索","缺乏结构化分支维度","复盘时难看出知识关系"]
right=["插件内直接采集并入库","主题/分支/标签结构化管理","图谱可视化展示关联网络","同分支聚焦提升复盘效率"]
for i,tv in enumerate(left):
    txt(s,1.0,2.45+i*0.85,5.3,0.35,f"• {tv}",13,False,RGBColor(120,130,150))
for i,tv in enumerate(right):
    txt(s,6.9,2.45+i*0.85,5.3,0.35,f"• {tv}",13,False,TEXT)

# Slide 8 - Closing
s = prs.slides.add_slide(prs.slide_layouts[6])
rect(s,0,0,13.333,7.5,BG)
for i in range(5):
    b=rect(s,-1.0+i*2.8,5.0-i*0.35,5.2,2.8,RGBColor(220,233,255),None,True)
    b.fill.transparency=0.55
rect(s,0,0,13.333,0.55,WHITE)
rect(s,0,0,3.8,0.08,BLUE)
txt(s,0.8,1.55,11.5,1.2,"感谢聆听 · Q&A",48,True,BLUE_D,PP_ALIGN.CENTER)
txt(s,1.7,3.0,10,0.8,"智联微记：让网页信息从“可见”走向“可用、可复盘、可迁移”",18,False,MUTED,PP_ALIGN.CENTER)
rect(s,4.5,4.35,4.3,0.9,BLUE,None,True)
txt(s,4.5,4.62,4.3,0.3,"课程汇报 / 产品介绍 / 毕设答辩",16,True,WHITE,PP_ALIGN.CENTER)

prs.save(OUT)
print(OUT)
