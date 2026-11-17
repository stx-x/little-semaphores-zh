import re, os, glob

os.chdir('/Users/kk/WorkBuddy/os翻译/lbs/docs')

CH = [
    ('intro', '导论', 'Introduction'),
    ('semaphores', '信号量', 'Semaphores'),
    ('patterns', '基本同步模式', 'Basic Synchronization Patterns'),
    ('classical', '经典同步问题', 'Classical Synchronization Problems'),
    ('less-classical', '不太经典的问题', 'Less Classical Synchronization Problems'),
    ('not-classical', '非经典问题', 'Not-so-classical Problems'),
    ('remotely-classical', '远非经典的问题', 'Not Remotely Classical Problems'),
    ('python', 'Python 中的同步', 'Synchronization in Python'),
    ('c', 'C 语言中的同步', 'Synchronization in C'),
    ('cleanup-python', '清理 Python 线程', 'Cleaning up Python Threads'),
    ('cleanup-posix', '清理 POSIX 线程', 'Cleaning up POSIX Threads'),
]

stats = []
for key, title, en in CH:
    p = key + '.md'
    s = open(p).read()
    s = re.sub(r'^---[\s\S]*?---\s*', '', s)
    s = re.sub(r'^#\s+[^\n]*\n', '', s)
    head = '---\ntitle: "%s"\n---\n\n# %s\n\n<div class="chap-en">%s</div>\n\n' % (title, title, en)
    open(p, 'w').write(head + s.strip() + '\n')
    cn = len(re.findall(r'[\u4e00-\u9fff]', s))
    code = len(re.findall(r'^```', s, re.M)) // 2
    det = len(re.findall(r'^::: details', s, re.M))
    secs = re.findall(r'^##\s+([^\n]+)$', s, re.M)
    stats.append((key, title, en, cn, code, det, secs))

print('%-20s %-16s %6s %4s %3s %3s' % ('key', 'title', '汉字', '码', '折', '节'))
for k, t, e, cn, c, d, sc in stats:
    print('%-20s %-16s %6d %4d %3d %3d' % (k, t, cn, c, d, len(sc)))
print('总汉字:', sum(x[3] for x in stats), ' 总折叠:', sum(x[5] for x in stats))

# 目录页
out = ['---', 'title: 完整目录', '---', '', '# 完整目录', '', '<div class="toc-vol">', '']
for k, t, e, cn, c, d, secs in stats:
    out.append('<a class="toc-ch" href="/little-semaphores-zh/%s">' % k)
    out.append('<span class="toc-ch-title">%s</span>' % t)
    out.append('<span class="toc-ch-en">%s</span>' % e)
    out.append('</a>')
    if secs:
        out.append('<div class="toc-secs">')
        for s in secs:
            out.append(re.sub(r'[*`]', '', s).strip() + '<br>')
        out.append('</div>')
out.append('</div>')
open('contents.md', 'w').write('\n'.join(out) + '\n')
print('contents.md ok')
