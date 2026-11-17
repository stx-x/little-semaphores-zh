---
title: "Python 中的同步"
---

# Python 中的同步

<div class="chap-en">Synchronization in Python</div>

借助伪代码，我们避开了现实世界中同步的一些丑陋细节。本章我们来看 Python 中真正的同步代码，下一章再看 C。

Python 提供了相当好用的多线程环境，还自带 Semaphore 对象。它有一些小毛病，不过附录里有一段清理代码，能让情况稍微好一点。

下面是一个简单的例子：

```python
from threading_cleanup import *

class Shared:
    def __init__(self):
        self.counter = 0

def child_code(shared):
    while True:
        shared.counter += 1
        print shared.counter
        time.sleep(0.5)

shared = Shared()
children = [Thread(child_code, shared) for i in range(2)]
for child in children: child.join()
```

第一行运行的是附录里的清理代码；在后面的其他例子里，我会省略这一行。

`Shared` 定义了一种用来存放共享变量的对象类型。全局变量在线程之间也是共享的，不过在这些例子里我们不会用到。函数内部声明的变量是局部变量，同时也只属于当前线程。

子线程的代码是一个无限循环：递增 `counter`，打印新值，然后睡眠 0.5 秒。

父线程创建 `shared` 和两个子线程，然后等待子线程退出（在这个例子里，它们不会退出）。

## 互斥检查器问题

用功学习同步的同学会发现，子线程对 `counter` 的更新没有同步，这是不安全的！如果你运行这个程序，也许会看到一些错误，但多半看不到。同步错误最讨厌的地方就在于不可预测，这意味着即使做大量测试，也可能发现不了它们。

要检测错误，往往得把查找过程自动化。在这个例子里，我们可以通过记录 `counter` 的取值来发现错误。

```python
class Shared:
    def __init__(self, end=10):
        self.counter = 0
        self.end = end
        self.array = [0]* self.end

def child_code(shared):
    while True:
        if shared.counter >= shared.end: break
        shared.array[shared.counter] += 1
        shared.counter += 1

shared = Shared(10)
children = [Thread(child_code, shared) for i in range(2)]
for child in children: child.join()
print shared.array
```

在这个例子里，`shared` 里有一个列表（名字叫 `array`，有点误导），用来记录 `counter` 的每个取值被用到了多少次。每次循环，子线程先检查 `counter`，如果它超过 `end` 就退出；否则，就用 `counter` 作为下标访问 `array`，把对应的项加一。然后它们把 `counter` 加一。

如果一切正常，数组的每一项都应该恰好被加一。子线程退出后，父线程从 `join` 返回，打印 `array` 的值。我运行这个程序时，得到的是

    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1]

结果正确得让人失望。如果加大数组的规模，我们也许会期待更多错误，但检查结果同时也变得更难。

我们可以让检查器自动完成这项工作：对数组里的结果做一个直方图。

```python
class Histogram(dict):
    def __init__(self, seq=[]):
        for item in seq:
            self[item] = self.get(item, 0) + 1

print Histogram(shared.array)
```

现在再运行程序，我得到的是

    {1: 10}

意思是值 1 出现了 10 次，和预期一致。到目前为止还没有错误，但如果把 `end` 调大，事情就有意思了：

    end = 100, {1: 100}
    end = 1000, {1: 1000}
    end = 10000, {1: 10000}
    end = 100000, {1: 27561, 2: 72439}

糟糕！当 `end` 大到子线程之间发生大量上下文切换时，我们就开始遇到同步错误了。在这个例子里，错误*非常*多，这说明程序陷入了一种反复出现的模式：线程总是在临界区里被打断。

这个例子说明了同步错误的一种危险之处：它们可能很罕见，但并不随机。如果一个错误在一百万次里只出现一次，那并不意味着它不会连续出现一百万次。

**问题**：给这个程序加上同步代码，保证对共享变量的互斥访问。本节的代码可以从 [greenteapress.com/semaphores/counter.py](http://greenteapress.com/semaphores/counter.py) 下载。

::: details 提示：互斥检查器
下面是我用的 `Shared` 版本：

```python
class Shared:
    def __init__(self, end=10):
        self.counter = 0
        self.end = end
        self.array = [0]* self.end
        self.mutex = Semaphore(1)
```

唯一的变化就是那个名为 `mutex` 的信号量，这应该不会让你感到意外。
:::

::: details 解答：互斥检查器
这是我的解法：

```python
def child_code(shared):
    while True:
        shared.mutex.wait()
        if shared.counter < shared.end:
            shared.array[shared.counter] += 1
            shared.counter += 1
            shared.mutex.signal()
        else:
            shared.mutex.signal()
            break
```

虽然这算不上本书中最难的同步问题，但你可能会发现要把细节都处理对并不容易。特别是很容易忘记在跳出循环之前给互斥锁发信号，那样就会造成死锁。

我用 `end = 1000000` 运行了这个解法，得到下面的结果：

    {1: 1000000}

当然，这并不能证明我的解法是正确的，但至少开局不错。
:::

## 可乐机问题

下面这个程序模拟生产者与消费者往可乐机里放可乐、从里面取可乐：

```python
import random

class Shared:
    def __init__(self, start=5):
        self.cokes = start

def consume(shared):
    shared.cokes -= 1
    print shared.cokes

def produce(shared):
    shared.cokes += 1
    print shared.cokes

def loop(shared, f, mu=1):
    while True:
        t = random.expovariate(1.0/mu)
        time.sleep(t)
        f(shared)

shared = Shared()
fs = [consume]*2 + [produce]*2 
threads = [Thread(loop, shared, f) for f in fs]
for thread in threads: thread.join()
```

可乐机的容量是 10 瓶，初始时半满，所以共享变量 `cokes` 的值是 5。

程序创建了 4 个线程，两个生产者、两个消费者。它们都运行 `loop`，只是生产者调用 `produce`，消费者调用 `consume`。这两个函数对共享变量的访问没有同步，这是绝对不允许的。

每次循环，生产者和消费者都会睡上一段时间，时长从均值为 `mu` 的指数分布中抽取。因为有两个生产者和两个消费者，所以平均每秒会有两瓶可乐被放进机器，同时有两瓶被取走。

于是平均来看可乐的数量保持不变，但短时间内波动可能相当大。如果你把程序运行一会儿，多半会看到 `cokes` 的值掉到零以下，或者涨到 10 以上。当然，这两种情况都不该发生。

**问题**：给这个程序加上代码，满足下面这些同步约束：

-   对 `cokes` 的访问必须是互斥的。

-   如果可乐数量为零，消费者应该阻塞，直到有人放入一瓶可乐。

-   如果可乐数量为 10，生产者应该阻塞，直到有人取走一瓶可乐。

你可以从 [greenteapress.com/semaphores/coke.py](http://greenteapress.com/semaphores/coke.py) 下载这个程序。

::: details 提示：可乐机
下面是我的解法中用到的共享变量：

```python
class Shared:
    def __init__(self, start=5, capacity=10):
        self.cokes = Semaphore(start)
        self.slots = Semaphore(capacity-start)
        self.mutex = Semaphore(1)
```

现在 `cokes` 是一个信号量（不再是简单的整数），这让打印它的值变得有点麻烦。当然，你绝不该访问信号量的值，而 Python 一如既往地爱当好人，没有提供某些实现里那种作弊方法。

不过你也许会觉得有趣：信号量的值存在一个名为 `_Semaphore__value` 的私有属性里。另外，如果你还不知道的话——Python 其实并不真的限制对私有属性的访问。当然，你绝不该去碰它，我只是觉得你可能会有兴趣。

咳。
:::

::: details 解答：可乐机
如果你读过本书的其余部分，想出至少和下面一样好的方案应该不难：

```python
def consume(shared):
    shared.cokes.wait()
    shared.mutex.wait()
    print shared.cokes.value()
    shared.mutex.signal()
    shared.slots.signal()

def produce(shared):
    shared.slots.wait()
    shared.mutex.wait()
    print shared.cokes._Semaphore__value
    shared.mutex.signal()
    shared.cokes.signal()
```

把这个程序运行一段时间，你应该能确认机器里的可乐数量从不为负，也不会超过 10。所以这个解法看起来是正确的。

到目前为止。
:::
