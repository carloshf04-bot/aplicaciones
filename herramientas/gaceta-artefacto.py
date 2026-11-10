# Junta La Gaceta en un solo archivo para publicarla como artefacto de Claude.
# Uso: python3 herramientas/gaceta-artefacto.py docs/notas la-gaceta.html
import re,base64,sys,os
src=sys.argv[1]; out=sys.argv[2]
html=open(os.path.join(src,'index.html')).read()
head=re.search(r'<head>(.*?)</head>',html,re.S).group(1)
body=re.search(r'<body>(.*?)</body>',html,re.S).group(1)
style=re.search(r'<style>(.*?)</style>',head,re.S).group(1)
fonts=open(os.path.join(src,'fonts/fonts.css')).read()
def b64(m):
    data=base64.b64encode(open(os.path.join(src,'fonts',m.group(1)),'rb').read()).decode()
    return f'url(data:font/woff2;base64,{data})'
fonts=re.sub(r'url\(([^)]+\.woff2)\)',b64,fonts)
body=re.sub(r'<script type="module" src="app.js"></script>\s*<script>.*?</script>','',body,flags=re.S)
sync=open(os.path.join(src,'sync.js')).read()
sync=re.sub(r'^import .*?;\n','const FIREBASE_CONFIG = {};\n',sync,flags=re.M)
sync=sync.replace('export function','function')
app=open(os.path.join(src,'app.js')).read()
app=re.sub(r'^import .*?;\n','',app,flags=re.M)
page=f'''<title>La Gaceta</title>
<meta name="description" content="Tus notas como un periódico: cada nota es una libreta con sus páginas.">
<style>
{fonts}
{style}
</style>
{body}
<script type="module">
window.__GACETA_ARTIFACT__ = true;
{sync}
{app}
</script>
'''
open(out,'w').write(page)
print(len(page))
