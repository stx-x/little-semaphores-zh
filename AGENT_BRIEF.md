# 翻译任务简报 ·《The Little Book of Semaphores》

把英文 Markdown 译为中文，用于 VitePress 网页。作者 Allen B. Downey，CC BY-NC-SA 4.0。

## 输入输出

- 输入：`/Users/kk/WorkBuddy/os翻译/lbs/src/<name>.md`
- 输出：`/Users/kk/WorkBuddy/os翻译/lbs/docs/<name>.md`
- 不加 frontmatter，直接从正文开始。

## 源文件的标记

| 标记 | 含义 | 处理 |
|---|---|---|
| ```` ```text title="Thread A" ```` | 伪代码/线程片段，带标题 | 语言标记与 `title` 值**保留英文**（Thread A / Thread B），块内代码不译 |
| ```` ```python ```` | Python 代码 | 原样保留 |
| `::: details 提示：X` … `:::` | 可折叠的提示 | 保留容器，标题译为「提示：X」 |
| `::: details 解答：X` … `:::` | 可折叠的解答 | 同上，「解答：X」 |
| `**问题**：` | 题目开头 | 保留 |
| `## X` / `### X` | 小节标题 | 译 |
| `` `code` `` | 行内代码 | 保留英文，不译 |

**注意**：`title="..."` 里的 Thread A / Thread B / Semaphore 等保持英文，不要译成中文。

## 翻译要求

1. 逐段完整翻译，不省略不合并。
2. 教学语气：作者在跟读者对话，常有"你能想出办法吗""先别看提示"这类话，要保持这种亲切、鼓励的口吻。
3. 术语统一（见下表），首次出现可括注英文。
4. 代码标识符（`sem.wait()`、`aArrived`、`mutex`）一律保留英文。
5. 段落中的 `**加粗**` 保留（VitePress 能正确渲染）。

## 术语表

| 英文 | 中文 |
|---|---|
| semaphore | 信号量 |
| signal | 发信号（`signal()` 保留） |
| wait | 等待（`wait()` 保留） |
| rendezvous | 会合 |
| barrier | 屏障 |
| reusable barrier | 可复用屏障 |
| multiplex | 复用（允许多个线程同时进入） |
| mutex | 互斥锁 |
| mutual exclusion | 互斥 |
| critical section | 临界区 |
| synchronization | 同步 |
| serialization | 串行化 |
| non-determinism | 不确定性 |
| execution model | 执行模型 |
| thread | 线程 |
| starvation | 饥饿 |
| deadlock | 死锁 |
| fairness | 公平性 |
| bounded buffer | 有界缓冲区 |
| producer-consumer | 生产者-消费者 |
| readers-writers | 读者-写者 |
| dining philosophers | 哲学家就餐 |
| cigarette smokers | 吸烟者 |
| barbershop | 理发店 |
| roller coaster | 过山车 |
| unisex bathroom | 男女共用洗手间 |
| baboon crossing | 狒狒过河 |
| sushi bar | 寿司店 |
| child care | 托儿所 |
| room party | 宿舍派对 |
| senate bus | 参议院班车 |
| dining hall | 食堂 |
| Faneuil Hall | 法尼尔厅（波士顿地名，保留原名亦可） |
| pass the baton | 传递接力棒 |
| I'll do it for you | 我替你办 |

## 自检

```bash
cd /Users/kk/WorkBuddy/os翻译/lbs
python3 - <<'EOF'
import re
src=open('src/NAME.md').read(); dst=open('docs/NAME.md').read()
for pat,name in [(r'```','代码块'),(r'::: details','折叠块'),(r'\*\*问题\*\*','问题标记')]:
    a=len(re.findall(pat,src)); b=len(re.findall(pat,dst))
    print(name,a,b,'OK' if a==b else 'MISMATCH')
print('汉字',len(re.findall(r'[\u4e00-\u9fff]',dst)))
EOF
```

## 完成后

回复：路径 + 汉字数 + 自检结果。**不要贴全文。**
