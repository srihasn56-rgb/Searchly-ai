# searchly_server.spec  — PyInstaller 6.x compatible
# Build with:  pyinstaller searchly_server.spec --noconfirm --clean

from PyInstaller.utils.hooks import collect_data_files, collect_submodules, collect_all

block_cipher = None

# --collect-all ensures both code AND data files are included
flask_datas,    flask_bins,    flask_hiddens    = collect_all('flask')
cors_datas,     cors_bins,     cors_hiddens     = collect_all('flask_cors')
clip_datas,     clip_bins,     clip_hiddens     = collect_all('open_clip')
torch_datas,    torch_bins,    torch_hiddens    = collect_all('torch')
tv_datas,       tv_bins,       tv_hiddens       = collect_all('torchvision')
pil_datas,      pil_bins,      pil_hiddens      = collect_all('PIL')
numpy_datas,    numpy_bins,    numpy_hiddens    = collect_all('numpy')
certifi_datas,  certifi_bins,  certifi_hiddens  = collect_all('certifi')
psutil_datas,   psutil_bins,   psutil_hiddens   = collect_all('psutil')

all_datas    = flask_datas   + cors_datas   + clip_datas   + torch_datas   + tv_datas   + pil_datas   + numpy_datas   + certifi_datas   + psutil_datas
all_binaries = flask_bins    + cors_bins    + clip_bins    + torch_bins    + tv_bins    + pil_bins    + numpy_bins    + certifi_bins    + psutil_bins
all_hiddens  = flask_hiddens + cors_hiddens + clip_hiddens + torch_hiddens + tv_hiddens + pil_hiddens + numpy_hiddens + certifi_hiddens + psutil_hiddens + [
    'werkzeug', 'werkzeug.serving', 'werkzeug.routing',
    'click', 'itsdangerous', 'jinja2', 'markupsafe',
    'torch._C', 'torch.nn', 'torch.nn.functional',
    'torchvision.transforms',
    'open_clip.tokenizer', 'open_clip.transformer',
    'ftfy', 'regex', 'tqdm',
]

a = Analysis(
    ['server.py'],
    pathex=[],
    binaries=all_binaries,
    datas=all_datas,
    hiddenimports=all_hiddens,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=['tkinter', 'matplotlib', 'scipy', 'pandas', 'IPython', 'jupyter', 'cv2'],
    noarchive=False,
)

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='searchly_server',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=True,          # FIXED: must be True for Flask server to work
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='searchly_server',
)
