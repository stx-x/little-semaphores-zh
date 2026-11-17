---
title: "清理 Python 线程"
---

# 清理 Python 线程

<div class="chap-en">Cleaning up Python Threads</div>

<div class="chap-en">Cleaning up Python Threads</div>

和其他许多线程环境相比，Python 的线程已经相当不错了，不过有几个特性让我很恼火。好在只要写一点清理代码，就能把它们修好。

## 信号量方法

首先是 Python 信号量的方法叫 `acquire` 和 `release`。这个选择本身完全合理，但写了两年这本书之后，我已经习惯 `signal` 和 `wait` 了。好在只要继承 `threading` 模块里的 Semaphore，我就能让它按我的方式来：

```python title="Semaphore name change"
import threading
 
class Semaphore(threading._Semaphore):
    wait = threading._Semaphore.acquire
    signal = threading._Semaphore.release
```

定义好这个类之后，你就可以用本书中的语法来创建和操作信号量了。

```python title="Semaphore example"
mutex = Semaphore()
mutex.wait()
mutex.signal()
```

## 创建线程

`threading` 模块另一个让我恼火的地方，是创建和启动线程的接口。常规做法要用关键字参数，还得走两步：

```python title="Thread example (standard way)"
import threading

def function(x, y, z):
    print x, y, z

thread = threading.Thread(target=function, args=[1, 2, 3])
thread.start()
```

在这个例子里，创建线程并不会立刻产生任何效果。但当你调用 `start` 时，新线程就会用给定的参数执行目标函数。如果你需要在线程启动之前对它做点什么，这种做法很棒，可我几乎从来用不上。另外，我觉得 `target` 和 `args` 这两个关键字参数很别扭。

好在四行代码就能把这两个问题一起解决。

```python title="Cleaned-up Thread class"
class Thread(threading.Thread):
    def __init__(self, t, *args):
        threading.Thread.__init__(self, target=t, args=args)
        self.start()
```

现在我们就能用更顺手的接口创建线程了，而且它们会自动启动：

```python title="Thread example (my way)"
thread = Thread(function, 1, 2, 3)
```

这种写法还顺带引出一个我喜欢的惯用法：用列表推导式创建多个 Thread：

```python title="Multiple thread example"
threads = [Thread(function, i, i, i) for i in range(10)]
```

## 处理键盘中断

`threading` 类还有一个问题：`Thread.join` 无法被 Ctrl-C 中断。Ctrl-C 会产生 `SIGINT` 信号，而 Python 把它转换成 KeyboardInterrupt。

所以，如果你写出下面这个程序：

```python title="Unstoppable program"
import threading, time

class Thread(threading.Thread):
    def __init__(self, t, *args):
        threading.Thread.__init__(self, target=t, args=args)
        self.start()

def parent_code():
    child = Thread(child_code, 10)
    child.join()

def child_code(n=10):
    for i in range(n):
        print i
        time.sleep(1)
    
parent_code()
```

你会发现它没法用 Ctrl-C 或 `SIGINT` 中断[^1]。

我对这个问题的绕行方案用了 `os.fork` 和 `os.wait`，所以只能在 UNIX 和 Macintosh 上使用。它的原理是这样：在创建新线程之前，程序先调用 `watcher`，由它 fork 出一个新进程。新进程从 `watcher` 返回，继续执行程序余下的部分。原来的进程则等待子进程结束——`watcher`（看守者）这个名字就是这么来的：

```python title="The watcher"
import threading, time, os, signal, sys

class Thread(threading.Thread):
    def __init__(self, t, *args):
        threading.Thread.__init__(self, target=t, args=args)
        self.start()

def parent_code():
    child = Thread(child_code, 10)
    child.join()

def child_code(n=10):
    for i in range(n):
        print i
        time.sleep(1)

def watcher():
    child = os.fork()
    if child == 0: return
    try:
        os.wait()
    except KeyboardInterrupt:
        print 'KeyboardInterrupt'
        os.kill(child, signal.SIGKILL)
    sys.exit()

watcher()
parent_code()
```

如果你运行这个版本的程序，应该就能用 Ctrl-C 把它中断了。我不太确定，但我认为 `SIGINT` 保证会送到 watcher 进程，这样父线程和子线程就少了一件事要操心。

这些代码我都放在一个名为 `threading_cleanup.py` 的文件里，你可以从 [greenteapress.com/semaphores/threading_cleanup.py](http://greenteapress.com/semaphores/threading_cleanup.py) 下载。

Python 那一章的例子，都假定这段代码先于示例代码执行。

[^1]: 写这本书的时候，这个 bug 已经有人报告过，并分配了编号 1167930，但它仍然处于开启状态，也没有指派给任何人（<https://sourceforge.net/projects/python/>）。
