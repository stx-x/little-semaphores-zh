---
title: "不太经典的问题"
---

# 不太经典的问题

<div class="chap-en">Less Classical Synchronization Problems</div>

<div class="chap-en">Less Classical Synchronization Problems</div>

本题出自 Andrews 的《Concurrent Programming》[@andrews]。

> 一个野蛮人部落用一口大锅共进晚餐，锅里能盛 M 份炖传教士[^1]。某个野蛮人想吃东西时，就从锅里自取一份，除非锅是空的。如果锅空了，这个野蛮人就去叫醒厨师，然后一直等到厨师把锅重新装满。

任意数量的野蛮人线程都执行下面的代码：

```python title="Unsynchronized savage code"
while True:
    getServingFromPot()
    eat()
```

而一个厨师线程执行这段代码：

```python title="Unsynchronized cook code"
while True:
    putServingsInPot(M)
```

同步约束是：

-   锅为空时，野蛮人不能调用 `getServingFromPot`。

-   只有当锅为空时，厨师才能调用 `putServingsInPot`。

**问题**：为野蛮人和厨师补上代码，使上述同步约束得到满足。

::: details 提示：食堂野蛮人
很容易想到像生产者-消费者问题那样，用一个信号量来记录剩余的份数。但要在这锅见底时给厨师发信号，线程就必须在递减信号量**之前**知道自己会不会被阻塞，而我们做不到这一点。

另一种做法是用记分牌来记录份数。如果野蛮人发现计数器为零，他就叫醒厨师，并等待一个「锅已装满」的信号。下面是我用的变量：

```python title="Dining Savages hint"
servings = 0
mutex = Semaphore(1)
emptyPot = Semaphore(0)
fullPot = Semaphore(0)
```

不出所料，`emptyPot` 表示锅是空的，`fullPot` 表示锅是满的。
:::

::: details 解答：食堂野蛮人
我的解法把记分牌模式和会合结合起来。下面是厨师的代码：

```python title="Dining Savages solution (cook)"
while True:
    emptyPot.wait()
    putServingsInPot(M)
    fullPot.signal()
```

野蛮人的代码只稍微复杂一点。每个野蛮人通过互斥锁时都会检查锅的状态。如果锅是空的，他就给厨师发信号并等待；否则他把 `servings` 减一，然后从锅里取一份。

```python title="Dining Savages solution (savage)"
while True:
    mutex.wait()
        if servings == 0:
            emptyPot.signal()
            fullPot.wait()
            servings = M
        servings -= 1
    getServingFromPot()
    mutex.signal()

    eat()
```

由野蛮人而不是厨师来设置 `servings = M`，看起来有点奇怪。这其实并非必要：厨师执行 `putServingsInPot` 时，我们知道持有互斥锁的那个野蛮人正等在 `fullPot` 上，所以厨师访问 `servings` 是安全的。但在这里我选择让野蛮人来设置，这样光看代码就能明白：对 `servings` 的所有访问都在互斥锁之内。

这个解法不会死锁。唯一可能死锁的地方，是持有 `mutex` 的野蛮人等待 `fullPot` 的时候。在他等待期间，其他野蛮人排在 `mutex` 上。但厨师最终会运行并给 `fullPot` 发信号，让那个等待的野蛮人继续执行并释放互斥锁。

这个解法是假设锅本身是线程安全的，还是保证了 `putServingsInPot` 和 `getServingFromPot` 互斥地执行？

:::

## 理发店问题

最初的理发店问题由 Dijkstra 提出。Silberschatz 和 Galvin 的《操作系统概念》中给出了它的一个变体 [@silberschatz]。

> 一间理发店有一间放着 $n$ 把椅子的等候室，还有一间理发室，里面放着理发椅。如果没有顾客需要服务，理发师就睡觉。如果一位顾客走进理发店时所有椅子都有人，他就离开。如果理发师正忙，但还有空椅子，顾客就坐到一把空椅子上。如果理发师在睡觉，顾客就叫醒他。写一个程序来协调理发师和顾客。

为了让问题更具体一些，我补充了以下信息：

-   顾客线程应调用名为 `getHairCut` 的函数。

-   如果顾客线程在店满时到达，它可以调用 `balk`，该函数不会返回。

-   理发师线程应调用 `cutHair`。

-   理发师调用 `cutHair` 时，应当恰好有一个线程在并发地调用 `getHairCut`。

写一个满足这些约束的解法。

::: details 提示：理发店
```python title="Barbershop hint"
n = 4
customers = 0
mutex = Semaphore(1)
customer = Semaphore(0)
barber = Semaphore(0)
customerDone = Semaphore(0)
barberDone = Semaphore(0)
```

`n` 是店里最多能容纳的顾客总数：等候室三把椅子，加上理发椅上的一位。

`customers` 记录店里的顾客数，由 `mutex` 保护。

理发师在 `customer` 上等待，直到有顾客进店；然后顾客在 `barber` 上等待，直到理发师示意他就座。

理完发后，顾客给 `customerDone` 发信号，并等待 `barberDone`。
:::

::: details 解答：理发店
这个解法把记分牌和两个会合组合在一起[^2]。下面是顾客的代码：

```python title="Barbershop solution (customer)"
mutex.wait()
    if customers == n:
        mutex.signal()
        balk()
    customers += 1
mutex.signal()

customer.signal()
barber.wait()

# getHairCut()

customerDone.signal()
barberDone.wait()

mutex.wait()
    customers -= 1
mutex.signal()
```

如果店里已有 $n$ 位顾客，那么此后到达的顾客都立即调用 `balk`。否则每位顾客给 `customer` 发信号，然后在 `barber` 上等待。

下面是理发师的代码：

```python title="Barbershop solution (barber)"
customer.wait()
barber.signal()

# cutHair()

customerDone.wait()
barberDone.signal()
```

每当有顾客发信号，理发师就醒来，给 `barber` 发信号，然后理一个头。如果理发师忙碌期间又有顾客到达，那么在下一轮循环里，理发师会直接通过 `customer` 信号量而不会睡下。

`customer` 和 `barber` 的命名遵循会合（rendezvous）的命名惯例，所以 `customer.wait()` 的意思是「等一位顾客」，而不是「顾客在这里等」。

第二个会合使用 `customerDone` 和 `barberDone`，它保证理发真正完成之后，理发师才转回循环开头，把下一位顾客放进临界区。

这个解法见 `sync_code/barber.py`（见 [sync.py](#sync.py)）。

:::

## 先进先出的理发店

在上一个解法中，无法保证顾客按到达顺序接受服务。最多可以有 `n` 位顾客通过旋转门、给 `customer` 发信号并等在 `barber` 上。当理发师给 `barber` 发信号时，其中任何一个顾客都可能继续执行。

修改这个解法，使顾客按通过旋转门的顺序接受服务。

提示：你可以用 `self` 指代当前线程，所以如果写 `self.sem = Semaphore(0)`，每个线程都会得到自己的信号量。

::: details 提示：先进先出的理发店
我的解法使用一个名为 `queue` 的信号量列表。

```python title="FIFO barbershop hint"
n = 4
customers = 0
mutex = Semaphore(1)
customer = Semaphore(0)
customerDone = Semaphore(0)
barberDone = Semaphore(0)
queue = []
```

每个线程通过旋转门时，创建一个信号量并把它放进队列。

每个线程不再等待 `barber`，而是等待自己的信号量。理发师醒来后，从队列里取出一个线程并给它发信号。
:::

::: details 解答：先进先出的理发店
下面是修改后的顾客代码：

```python title="FIFO barbershop solution (customer)"
```

以及理发师的代码：

``` {.troff mandoc title="FIFO barbershop solution (barber)"}
```

注意理发师必须先取得 `mutex` 才能访问队列。

这个解法见 `sync_code/barber2.py`（见 [sync.py](#sync.py)）。
:::

## Hilzer 的理发店问题

William Stallings 给出了理发店问题的一个更复杂的版本 [@stallings]，他把这个版本归功于加州州立大学奇科分校的 Ralph Hilzer。

> 我们的理发店有三张理发椅、三位理发师，还有一块等候区：沙发上可以坐四位顾客，另外还有供其余顾客站立的空间。消防规定店内顾客总数不得超过 20 人。
>
> 如果店里已经被其他顾客挤满，顾客就不进店。进店之后，顾客在沙发上坐下；如果沙发已满，就站着。当有理发师空出来时，在沙发上坐得最久的那位顾客接受服务；此时如果还有站着的顾客，那么在店里待得最久的那位顾客坐到沙发上去。顾客理完发后，任何一位理发师都可以收款，但由于只有一台收银机，同一时刻只能为一位顾客结账。理发师的时间分成三部分：理发、收款，以及在椅子上睡觉等顾客。

换句话说，适用以下同步约束：

-   顾客按顺序调用以下函数：`enterShop`、`sitOnSofa`、`getHairCut` 和 `pay`。

-   理发师调用 `cutHair` 和 `acceptPayment`。

-   店满时，顾客不能调用 `enterShop`。

-   如果沙发满了，刚进店的顾客不能调用 `sitOnSofa`。

-   顾客调用 `getHairCut` 时，应当有一位理发师在并发地执行 `cutHair`，反之亦然。

-   最多应允许三位顾客并发执行 `getHairCut`，三位理发师并发执行 `cutHair`。

-   顾客必须先 `pay`，理发师才能 `acceptPayment`。

-   理发师必须 `acceptPayment` 之后，顾客才能离开。

**问题**：为 Hilzer 的理发店编写代码，满足上述同步约束。

::: details 提示：Hilzer 的理发店
下面是我在解法中用到的变量：

```python title="Hilzer's barbershop hint"
```

`mutex` 保护 `customers`（记录店里的顾客数）和 `queue1`（等待坐沙发的线程所对应的信号量列表）。

`mutex2` 保护 `queue2`，它是等待理发椅的线程所对应的信号量列表。

`sofa` 是一个复用（multiplex），用来限制沙发上顾客的最大数量。

`customer1` 表示 `queue1` 中有顾客，`customer2` 表示 `queue2` 中有顾客。

`payment` 表示顾客已付款，`receipt` 表示理发师已收款。
:::

::: details 解答：Hilzer 的理发店
这个解法比我预想的复杂得多。我不确定 Hilzer 心里是否有更简单的方案，但下面是我能做到的最好结果。

``` {.troff mandoc title="Hilzer's barbershop solution (customer)"}
```

第一段与上一个解法相同。顾客到达时检查计数器，要么 `balk`，要么把自己加入队列，然后给理发师发信号。

顾客从队列里出来后，进入复用（multiplex），在沙发上坐下，并把自己加入第二个队列。

当它从**那个**队列里出来后，理发、付款，然后离开。

``` {.troff mandoc title="Hilzer's barbershop solution (barber)"}
```

每位理发师等待顾客进店，给该顾客的信号量发信号把它从队列里放出来，然后等它坐进沙发。这保证了先进先出的要求。

接着理发师等待这位顾客加入第二个队列，然后给它发信号，让它去占一把理发椅。

每位理发师同时只放一位顾客上椅子，所以最多可以有三场理发并发进行。由于只有一台收银机，顾客必须先取得 `mutex`。顾客和理发师在收银机处会合，然后双方各自离开。

这个解法满足同步约束，但沙发没有得到充分利用。因为只有三位理发师，沙发上永远不可能超过三位顾客，所以那个复用其实是多余的。

这个解法见 `sync_code/barber3.py`（见 [sync.py](#sync.py)）。

我能想到的唯一办法是引入第三种线程，我把它叫做引座员（usher）。由引座员管理 `queue1`，由理发师管理 `queue2`。如果有 4 位引座员和 3 位理发师，沙发就能被充分利用。

这个解法见 `sync_code/barber4.py`（见 [sync.py](#sync.py)）。
:::

## 圣诞老人问题

本题出自 William Stallings 的《Operating Systems》[@stallings]，但他把题目归功于佛蒙特州圣迈克尔学院的 John Trono。

> 圣诞老人睡在北极的工坊里，只有两种情况能把他唤醒：(1) 九只驯鹿全都从南太平洋的度假地回来了；或者 (2) 有些小精灵做玩具时遇到了困难。为了让圣诞老人能睡个安稳觉，只有当三位小精灵都遇到问题时，他们才能去叫醒他。当三位小精灵的问题正在被解决时，其他想见圣诞老人的小精灵必须等这三位回来。如果圣诞老人醒来时发现门口等着三位小精灵，同时最后一只驯鹿也从热带回来了，那么圣诞老人已经决定：让小精灵等到圣诞节之后再说，因为把雪橇准备好更重要。（这里假定驯鹿并不想离开热带，所以它们会一直待到不能再拖的那一刻。）最后到达的那只驯鹿必须去叫醒圣诞老人，其余驯鹿则先在暖房里等着，然后再被套上雪橇。

另外还有一些细节规定：

-   第九只驯鹿到达后，圣诞老人必须调用 `prepareSleigh`，然后九只驯鹿必须都调用 `getHitched`。

-   第三位小精灵到达后，圣诞老人必须调用 `helpElves`；同时三位小精灵都应调用 `getHelp`。

-   必须等三位小精灵都调用了 `getHelp`，其他小精灵才能进入（即增加小精灵计数器）。

圣诞老人应当循环运行，这样才能帮助一批又一批的小精灵。可以假定驯鹿恰好有 9 只，而小精灵的数量可以任意多。

::: details 提示：圣诞老人问题
```python title="Santa problem hint"
elves = 0
reindeer = 0
santaSem = Semaphore(0)
reindeerSem = Semaphore(0)
elfTex = Semaphore(1)
mutex = Semaphore(1)
```

`elves` 和 `reindeer` 是计数器，都由 `mutex` 保护。小精灵和驯鹿取得 `mutex` 来修改计数器，圣诞老人取得它来检查计数器。

圣诞老人在 `santaSem` 上等待，直到有小精灵或驯鹿给他发信号。

驯鹿在 `reindeerSem` 上等待，直到圣诞老人示意它们进入围栏、套上雪橇。

小精灵用 `elfTex` 阻止其他小精灵在三位小精灵接受帮助期间进入。
:::

::: details 解答：圣诞老人问题
圣诞老人的代码相当直白。记住它是在一个循环里运行的。

```python title="Santa problem solution (Santa)"
santaSem.wait()
mutex.wait()
    if reindeer >= 9:
        prepareSleigh()
    reindeerSem.signal(9)
        reindeer -= 9
    else if elves == 3:
        helpElves()
mutex.signal()
```

圣诞老人醒来后检查两个条件中哪一个成立，然后要么处理驯鹿，要么处理等待的小精灵。如果有九只驯鹿在等，圣诞老人调用 `prepareSleigh`，然后对 `reindeerSem` 发九次信号，让驯鹿们去调用 `getHitched`。如果有小精灵在等，圣诞老人只调用 `helpElves`。小精灵无需等待圣诞老人；它们给 `santaSem` 发过信号后，就可以立刻调用 `getHelp`。

圣诞老人不必递减 `elves` 计数器，因为小精灵会在离开时自己减。

下面是驯鹿的代码：

```python title="Santa problem solution (reindeer)"
mutex.wait()
    reindeer += 1
    if reindeer == 9:
        santaSem.signal()
mutex.signal()

reindeerSem.wait()
getHitched()
```

第九只驯鹿给圣诞老人发信号，然后和其他驯鹿一起等待 `reindeerSem`。圣诞老人发信号后，所有驯鹿都执行 `getHitched`。

小精灵的代码类似，只不过第三位小精灵到达后，必须挡住后来的小精灵，直到前三位都执行完 `getHelp`。

```python title="Santa problem solution (elves)"
elfTex.wait()
mutex.wait()
    elves += 1
    if elves == 3:
        santaSem.signal()
    else
        elfTex.signal()
mutex.signal()

getHelp()

mutex.wait()
    elves -= 1
    if elves == 0:
       elfTex.signal()
mutex.signal()
```

前两位小精灵在释放 `mutex` 的同时释放 `elfTex`，而最后一位小精灵一直持有 `elfTex`，挡住其他小精灵，直到三位小精灵都调用了 `getHelp`。

最后离开的那位小精灵释放 `elfTex`，让下一批小精灵进入。
:::

## 合成 H₂O

至少十年来，这道题一直是加州大学伯克利分校操作系统课的保留题目。它似乎源自 Andrews《Concurrent Programming》中的一道练习 [@andrews]。

线程有两种：氧和氢。要把这些线程组装成水分子，我们需要一个屏障，让每个线程都等到一整个分子凑齐后再继续。

每个线程通过屏障时，应当调用 `bond`。你必须保证：一个分子的所有线程都调用了 `bond` 之后，下一个分子的线程才能调用。

换句话说：

-   如果氧线程到达屏障时没有氢线程在场，它必须等两个氢线程。

-   如果氢线程到达屏障时没有任何其他线程在场，它必须等一个氧线程和另一个氢线程。

我们不必操心显式地把线程配对；也就是说，线程并不需要知道自己是和哪些线程配成一组。关键在于线程要成整组地通过屏障：如果我们考察调用 `bond` 的线程序列，把它按三个一组划分，每一组都应当包含一个氧线程和两个氢线程。

**问题**：为氧线程和氢线程编写同步代码，满足上述约束。

::: details 提示：H₂O
下面是我在解法中用到的变量：

```python title="Water building hint"
mutex = Semaphore(1)
oxygen = 0
hydrogen = 0
barrier = Barrier(3)
oxyQueue = Semaphore(0)
hydroQueue = Semaphore(0)
```

`oxygen` 和 `hydrogen` 是计数器，由 `mutex` 保护。`barrier` 是每组三个线程在调用 `bond` 之后、允许下一组线程继续之前会合的地方。

`oxyQueue` 是氧线程等待的信号量，`hydroQueue` 是氢线程等待的信号量。这里沿用了队列的命名惯例：`oxyQueue.wait()` 的意思是「加入氧线程队列」，`oxyQueue.signal()` 的意思是「从队列中放出一个氧线程」。
:::

::: details 解答：H₂O
初始时 `hydroQueue` 和 `oxyQueue` 都是锁着的。氧线程到达时对 `hydroQueue` 发两次信号，让两个氢线程继续；然后氧线程等待氢线程到来。

```python title="Oxygen code"
mutex.wait()
oxygen += 1
if hydrogen >= 2:
    hydroQueue.signal(2)
    hydrogen -= 2
    oxyQueue.signal()
    oxygen -= 1
else:
    mutex.signal()

oxyQueue.wait()
bond()

barrier.wait()
mutex.signal()
```

每个氧线程进来时先取得互斥锁，查看记分牌。如果至少有两个氢线程在等，它就放出其中两个以及自己，然后结合（bond）。否则它释放互斥锁并等待。

结合之后，线程在屏障处等待，直到三个线程都结合完毕，然后由氧线程释放互斥锁。由于每组三个线程里只有一个氧线程，我们能保证 `mutex` 只被发一次信号。

氢线程的代码类似：

```python title="Hydrogen code"
mutex.wait()
hydrogen += 1
if hydrogen >= 2 and oxygen >= 1:
    hydroQueue.signal(2)
    hydrogen -= 2
    oxyQueue.signal()
    oxygen -= 1
else:
    mutex.signal()

hydroQueue.wait()
bond()

barrier.wait()
```

这个解法有个不寻常之处：互斥锁的出口位置并不唯一。有时线程进入互斥锁、更新计数器，然后退出互斥锁；但当某个线程凑齐了一整组时，它必须保留互斥锁，以便挡住后面的线程，直到当前这组都调用了 `bond`。

调用 `bond` 之后，三个线程在屏障处等待。屏障打开时，我们知道三个线程都调用了 `bond`，并且其中之一持有互斥锁。我们不知道**哪一个**线程持有它，但只要只有一个线程释放它就没问题。既然我们知道其中只有一个氧线程，就让它来干这件事。

这看起来可能不对，因为到目前为止，通常都是「谁持有锁，谁才能释放锁」。但并没有哪条规则要求必须如此。这正是那种情形：把互斥锁想成线程之间传来传去的令牌，会产生误导。
:::

## 过河问题

本题出自加州大学伯克利分校 Anthony Joseph 编写的一份习题集，但我不确定他是否是最初的作者。它和 H₂O 问题类似，都是一种特殊的屏障，只允许线程以特定的组合通过。

在华盛顿州雷德蒙德附近，有一条小划艇供 Linux 黑客和微软员工（农奴，serfs）过河之用。这条渡船恰好能载四个人，多一个少一个都不开船。为了保证乘客安全，不允许让一个黑客和三个农奴同船，也不允许让一个农奴和三个黑客同船。其他任何组合都是安全的。

每个线程上船时应当调用名为 `board` 的函数。你必须保证：一船四个线程都调用了 `board` 之后，下一船的线程才能调用。

四个线程都调用 `board` 之后，应当恰好有一个线程调用名为 `rowBoat` 的函数，表示由它来划桨。由哪个线程调用无所谓，只要有一个就行。

不必考虑行驶方向。假定我们只关心朝一个方向去的交通。

::: details 提示：过河
下面是我在解法中用到的变量：

```python title="River crossing hint"
barrier = Barrier(4)
mutex = Semaphore(1)
hackers = 0
serfs = 0
hackerQueue = Semaphore(0)
serfQueue = Semaphore(0)
local isCaptain = False
```

`hackers` 和 `serfs` 记录等待上船的黑客和农奴人数。由于两者都由 `mutex` 保护，我们可以在检查两个变量的状态时不必担心被中途更新。这是记分牌的又一个例子。

`hackerQueue` 和 `serfQueue` 让我们控制放行的黑客和农奴人数。屏障保证四个线程都调用了 `board` 之后，船长才调用 `rowBoat`。

`isCaptain` 是一个局部变量，指明哪个线程应当调用 `rowBoat`。
:::

::: details 解答：过河
这个解法的基本思路是：每个到达的线程先更新其中一个计数器，然后检查自己是否凑成了一整船——要么它自己是同类的第四个，要么它凑成了两两混合的组合。

我只给出黑客的代码；农奴的代码与之对称（当然，它要大 1000 倍、满是 bug，还内嵌了一个浏览器）：

```python title="River crossing solution"
mutex.wait()
    hackers += 1
    if hackers == 4:
        hackerQueue.signal(4)                
    hackers = 0
    isCaptain = True
    elif hackers == 2 and serfs >= 2:
        hackerQueue.signal(2)                
        serfQueue.signal(2)                  
    serfs -= 2
    hackers = 0
    isCaptain = True
    else:
        mutex.signal()      # captain keeps the mutex

hackerQueue.wait()           

board()
barrier.wait()            

if isCaptain:
    rowBoat()
    mutex.signal()          # captain releases the mutex
```

每个线程依次穿过互斥区时，都会检查是否已凑齐一整船人。如果凑齐了，它就给相应的线程发信号，宣布自己是船长，并保留互斥锁，以便挡住其他线程，直到船开走。

屏障记录已上船的线程数。最后一个线程到达时，所有线程一起继续。船长调用 `rowBoat`，然后（终于）释放互斥锁。
:::

## 过山车问题

本题出自 Andrews 的《Concurrent Programming》[@andrews]，但他把题目归功于 J. S. Herman 的硕士论文。

> 假设有 $n$ 个乘客线程和一个车厢线程。乘客反复地等着坐车，车厢可容纳 $C$ 位乘客，其中 $C<n$。车厢只有在坐满时才能沿轨道运行。

还有一些补充细节：

-   乘客应调用 `board` 和 `unboard`。

-   车厢应调用 `load`、`run` 和 `unload`。

-   车厢调用 `load` 之前，乘客不能上车。

-   $C$ 位乘客上车之前，车厢不能出发。

-   车厢调用 `unload` 之前，乘客不能下车。

**问题**：为乘客和车厢编写代码，满足这些约束。

::: details 提示：过山车
```python title="Roller Coaster hint"
mutex = Semaphore(1)
mutex2 = Semaphore(1)
boarders = 0
unboarders = 0
boardQueue = Semaphore(0)
unboardQueue = Semaphore(0)
allAboard = Semaphore(0)
allAshore = Semaphore(0)
```

`mutex` 保护 `passengers`，它记录已调用 `board` 的乘客数。

乘客在上车前等待 `boardQueue`，下车前等待 `unboardQueue`。`allAboard` 表示车厢已满。
:::

::: details 解答：过山车
下面是我写的车厢线程代码：

```python title="Roller Coaster solution (car)"
load()
boardQueue.signal(C)
allAboard.wait()

run()

unload()
unboardQueue.signal(C)
allAshore.wait()
```

车厢到站后对 $C$ 位乘客发信号，然后等待最后一位乘客发 `allAboard`。跑完一圈后，它放 $C$ 位乘客下车，然后等待 `allAshore`。

```python title="Roller Coaster solution (passenger)"
boardQueue.wait()
board()

mutex.wait()
   boarders += 1
   if boarders == C:
       allAboard.signal()
       boarders = 0
mutex.signal()

unboardQueue.wait()
unboard()

mutex2.wait()
   unboarders += 1
   if unboarders == C:
       allAshore.signal()
       unboarders = 0
mutex2.signal()
```

乘客自然要先等车厢到站才上车，也要等车厢停稳才下车。最后上车的乘客给车厢发信号，并重置乘客计数器。
:::

## 多车厢过山车问题

这个解法无法推广到多于一个车厢的情形。要做到这一点，我们必须满足一些额外的约束：

-   同一时刻只能有一个车厢在上客。

-   可以有多个车厢同时在轨道上运行。

-   由于车厢之间不能互相超越，它们必须按上客的顺序下客。

-   一车乘客全部下车之后，后面车厢的乘客才能下车。

**问题**：修改上一个解法以处理这些额外约束。可以假定有 $m$ 个车厢，每个车厢有一个名为 `i` 的局部变量，其值为 0 到 $m-1$ 之间的标识符。

::: details 提示：多车厢过山车
我用两个信号量列表来维持车厢的顺序。一个表示上客区，一个表示下客区。每个列表为每个车厢准备一个信号量。任何时候，每个列表中只有一个信号量是解锁的，这就强制了线程上客和下客的顺序。初始时只有 0 号车厢的信号量是解锁的。每个车厢进入上客区（或下客区）时等待自己的信号量，离开时给队列中的下一个车厢发信号。

```python title="Multi-car Roller Coaster hint"
loadingArea = [Semaphore(0) for i in range(m)]
loadingArea[0].signal()
unloadingArea = [Semaphore(0) for i in range(m)]
unloadingArea[0].signal()
```

函数 `next` 计算序列中下一个车厢的标识符（从 $m-1$ 绕回到 0）：

``` {title="Implementation of {\\tt next}"}
def next(i):
    return (i + 1) % m
```
:::

::: details 解答：多车厢过山车
下面是修改后的车厢代码：

```python title="Multi-car Roller Coaster solution (car)"
loadingArea[i].wait()
load()
boardQueue.signal(C)
allAboard.wait()
loadingArea[next(i)].signal()

run()

unloadingArea[i].wait()
unload()
unboardQueue.signal(C)
allAshore.wait()
unloadingArea[next(i)].signal()
```

乘客的代码不变。
:::

[^1]: 本题基于一种漫画式的想象，即西方传教士与狩猎采集社会相遇的历史。这里影射「哲学家就餐」问题，多少带点幽默；但正如之前的哲学家形象一样，这里的「野蛮人」也纯属虚构，并没有任何写实意图。如果你对狩猎采集社会感兴趣，我推荐 Jared Diamond 的《枪炮、病菌与钢铁》、Napoleon Chagnon 的《The Yanomamo》和 Redmond O'Hanlon 的《In Trouble Again》，但不推荐 Tierney 的《Darkness in El Dorado》，我认为那本书不可靠。
[^2]: rendezvous 的复数形式很少用到，各家词典的说法也不一致。另一种可能是复数仍拼作 "rendezvous"，但词尾的 "s" 要发音。
