#!/usr/bin/env python3
import re
from pathlib import Path
import os

# Получаем текущую директорию
current_dir = Path.cwd()
print(f"📍 Current directory: {current_dir}\n")

# Ищем все index.html файлы содержащие #loading-overlay
def find_files_with_loading_overlay():
    """Найти все index.html файлы с #loading-overlay"""
    files_found = []
    for html_file in current_dir.rglob('index.html'):
        try:
            content = html_file.read_text(encoding='utf-8')
            if 'id="loading-overlay"' in content:
                files_found.append(html_file)
        except: 
            pass
    return files_found

def remove_loading_overlay_html(content):
    """Удалить HTML блок #loading-overlay"""
    pattern = r'<!-- FUTURISTIC ALBASPACE LOADING OVERLAY -->\s*<div id="loading-overlay">.*?</div>\s*'
    content = re.sub(pattern, '', content, flags=re.DOTALL)
    return content

def remove_loading_overlay_css(content):
    """Удалить CSS стили для #loading-overlay и связанные анимации"""
    # Удаляем весь CSS блок от комментария до конца aninkeyframes progressGlow
    pattern = r'/\*\s*===+\s*FUTURISTIC ALBASPACE PRELOADER\s*===+\s*\*/\s*#loading-overlay\s*\{.*? @keyframes progressGlow\s*\{[^}]*\}\s*'
    content = re.sub(pattern, '', content, flags=re.DOTALL | re.IGNORECASE)
    return content

def remove_loading_overlay_script(content):
    """Удалить JavaScript для #loading-overlay"""
    # Ищем весь <script> блок с логикой прелоадера
    pattern = r'<!-- ЛОГИКА.*? ПРЕЛОАДЕРА.*?-->\s*<script>.*?</script>'
    content = re.sub(pattern, '', content, flags=re.DOTALL | re.IGNORECASE)
    return content

def process_file(filepath):
    """Обработать один файл"""
    try: 
        content = filepath.read_text(encoding='utf-8')
        original_content = content
        
        # Удаляем HTML
        content = remove_loading_overlay_html(content)
        
        # Удаляем CSS
        content = remove_loading_overlay_css(content)
        
        # Удаляем JavaScript
        content = remove_loading_overlay_script(content)
        
        if content != original_content:
            filepath.write_text(content, encoding='utf-8')
            return True, "✓ Removed #loading-overlay"
        else:
            return False, "⊘ No #loading-overlay found"
    except Exception as e:
        return False, f"✗ Error:  {str(e)}"

# Поиск файлов
print("🔍 Searching for files with #loading-overlay.. .\n")
files_to_process = find_files_with_loading_overlay()

if not files_to_process:
    print("❌ No files with #loading-overlay found!")
    exit(1)

print(f"✅ Found {len(files_to_process)} files to process:\n")

# Обработка файлов
changed_count = 0

for filepath in sorted(files_to_process):
    relative_path = filepath.relative_to(current_dir)
    success, message = process_file(filepath)
    print(f"  {'✓' if success else '⊘'} {relative_path}:  {message}")
    if success:
        changed_count += 1

print(f"\n{'='*60}")
print(f"✅ Total processed: {changed_count}/{len(files_to_process)} files updated")
print(f"⚠️  NOTE: #preloader (global page loader) was preserved!")
print(f"{'='*60}")