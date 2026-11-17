---
title: "基本同步模式"
---

# 基本同步模式

<div class="chap-en">Basic Synchronization Patterns</div>

本章介绍一系列基本的同步问题，并展示如何用信号量来解决它们。这些问题包括我们已经见过的串行化和互斥，以及另外一些。

## 发信号

信号量最简单的用法大概就是**发信号**（signaling），即一个线程向另一个线程发送信号，表示某件事已经发生。

发信号可以保证一个线程中的某段代码先于另一个线程中的某段代码执行；换句话说，它解决了串行化问题。

假设我们有一个名为 `sem` 的信号量，初始值为 0，线程 A 和线程 B 都能访问它。

```text title="Thread A"
statement a1
sem.signal()
```

```text title="Thread B"
sem.wait()
statement b1
```

这里的 `statement` 表示任意一条程序语句。为了让例子具体一点，可以设想 `a1` 从文件中读取一行，而 `b1` 把这一行显示在屏幕上。这个程序中的信号量保证：线程 B 开始执行 `b1` 之前，线程 A 已经完成了 `a1`。

下面说明它为什么有效：如果线程 B 先执行到 `wait`，它会发现信号量的初始值是 0，于是阻塞。等到线程 A 发出信号，线程 B 才继续。

同样，如果线程 A 先执行到 `signal`，信号量的值会加一，那么线程 B 到达 `wait` 时就会立刻继续。无论哪种情况，`a1` 和 `b1` 的先后顺序都得到了保证。

这种用法正是 `signal` 和 `wait` 这两个名字的由来，而且在这个例子里，名字恰好很好记。遗憾的是，后面我们还会看到一些例子，那时这两个名字就不那么管用了。

说到有意义的名字，`sem` 就算不上。只要可能，最好给信号量起一个能说明它代表什么的名字。在这个例子里，`a1Done` 就是个不错的选择：`a1done.signal()` 表示“发出 a1 已完成的信号”，而 `a1done.wait()` 表示“等到 a1 完成为止”。

## Sync.py

（本节待补。）

为什么线程 B 要对 `initComplete` 发信号？

## 会合

**问题**：把发信号模式推广成双向的。线程 A 必须等待线程 B，反之亦然。也就是说，给定下面这段代码

```text title="Thread A"
statement a1
statement a2
```

```text title="Thread B"
statement b1
statement b2
```

我们要保证 `a1` 先于 `b2` 发生、`b1` 先于 `a2` 发生。写解答时，请务必说明你所用信号量的名字和初始值（这里给了个小提示）。

你的解答不应施加过多约束。例如，我们并不关心 `a1` 和 `b1` 谁先谁后。在你的解答里，两种顺序都应当是可能的。

这个同步问题有个名字，叫做**会合**（rendezvous）。意思是两个线程在执行过程中的某一点会合，在双方都到达之前，谁也不能继续前进。

::: details 提示：会合
你多半已经想出解法了，如果没有，这里给个提示。创建两个信号量，分别命名为 `aArrived` 和 `bArrived`，并把它们都初始化为 0。

顾名思义，`aArrived` 表示线程 A 是否已经到达会合点，`bArrived` 同理。
:::

::: details 解答：会合
下面是我的解答，基于上面的提示：

```text title="Thread A"
statement a1
aArrived.signal()
bArrived.wait()
statement a2
```

```text title="Thread B"
statement b1
bArrived.signal()
aArrived.wait()
statement b2
```

在思考上一题时，你也许试过下面这种写法：

```text title="Thread A"
statement a1
bArrived.wait()
aArrived.signal()
statement a2
```

```text title="Thread B"
statement b1
bArrived.signal()
aArrived.wait()
statement b2
```

这个解答也能工作，不过效率大概要低一些，因为它可能不得不在 A 和 B 之间多切换一次。

如果 A 先到达，它就会等待 B。B 到达后唤醒 A，然后可能立刻执行自己的 `wait`，于是阻塞，让 A 得以执行到 `signal`，之后两个线程都可以继续。

想一想这段代码的其他可能执行路径，说服自己：在所有情况下，只要还有一方没到达，任何线程都无法继续。
:::

### 死锁 #1

同样，在思考上一题时，你也许试过这样写：

```text title="Thread A"
statement a1
bArrived.wait()
aArrived.signal()
statement a2
```

```text title="Thread B"
statement b1
aArrived.wait()
bArrived.signal()
statement b2
```

如果你真这么写了，希望你能很快把它否掉，因为它有个严重的问题。假设 A 先到达，它会在自己的 `wait` 处阻塞。B 到达后也会阻塞，因为 A 没能对 `aArrived` 发信号。此时两个线程都无法继续，而且永远无法继续。

这种情况叫做**死锁**（deadlock），显然它不是一个成功的同步解法。这里的错误很明显，但很多时候死锁的可能性要隐蔽得多。后面我们还会看到更多例子。

## 互斥锁

信号量的第二种常见用法是强制互斥。我们已经见过一种互斥的用法，即控制对共享变量的并发访问。互斥锁保证同一时刻只有一个线程访问共享变量。

互斥锁就像一个在多个线程之间传递的令牌，同一时刻只允许一个线程继续执行。例如在《蝇王》里，一群孩子用一只海螺当互斥锁：想发言就得拿着海螺。只要只有一个孩子拿着海螺，同一时刻就只有一个人能说话[^1]。

同样，线程要访问共享变量，就得“取得”互斥锁；用完之后再“释放”它。同一时刻只能有一个线程持有互斥锁。

**问题**：为下面的例子加上信号量，使对共享变量 `count` 的访问满足互斥。

```python title="Thread A"
count = count + 1
```

```python title="Thread B"
count = count + 1
```

::: details 提示：互斥
创建一个名为 `mutex` 的信号量，把它初始化为 1。值为 1 表示线程可以继续并访问共享变量；值为 0 表示它必须等待另一个线程释放互斥锁。
:::

::: details 解答：互斥
下面是一个解答：

```python title="Thread A"
mutex.wait()
    # critical section
    count = count + 1
mutex.signal()
```

```python title="Thread B"
mutex.wait()
    # critical section
    count = count + 1
mutex.signal()
```

由于 `mutex` 的初值是 1，先到达 `wait` 的那个线程可以立刻继续。当然，在信号量上等待会使它减一，所以后到的线程必须等到第一个线程发出信号。

我把更新操作缩进了，以表明它被包含在互斥锁内部。

在这个例子里，两个线程运行的是同一段代码。这有时称为**对称**（symmetric）解法。如果两个线程必须运行不同的代码，解法就是**非对称**（asymmetric）的。对称解法通常更容易推广。在这个例子里，互斥锁解法不用做任何修改就能应付任意多个并发线程。只要每个线程在更新前等待、更新后发信号，就不会有两个线程同时访问 `count`。

需要保护的这段代码通常叫做**临界区**（critical section），我想是因为防止并发访问这件事“至关重要”（critically important）吧。

按照计算机科学界爱混用比喻的传统，人们谈到互斥锁时还有几种别的说法。在我们一直使用的比喻里，互斥锁是一个在多个线程之间传递的令牌。

在另一种比喻里，我们把临界区想成一个房间，同一时刻只允许一个线程待在里面。在这种比喻下，互斥锁叫做锁（lock），线程在进入前“加锁”，离开时“解锁”。不过偶尔也有人把两种比喻混着用，说“取得”或“释放”一把锁，这就有点说不通了。

两种比喻都可能有用，也都可能误导人。在做下一题时，不妨两种思路都试一试，看看哪一种能带你找到答案。

:::

## 复用

**问题**：把前面的解法推广一下，使多个线程可以同时进入临界区，但对并发线程数设定上限。也就是说，同一时刻最多只能有 `n` 个线程在临界区中运行。

这个模式叫做**复用**（multiplex）。在现实生活中，复用问题出现在拥挤的夜店里：出于消防安全，或者为了营造“一票难求”的感觉，店里同时容纳的人数有上限。

在这种地方，通常由门口保安来执行这个同步约束：他记着里面有多少人，客满时就把新来的挡在门外。之后每有一个人出来，就放一个人进去。

用信号量来实现这个约束听起来可能很难，其实几乎不费吹灰之力。

::: details 解答：复用
要让多个线程进入临界区，只要把信号量初始化为 `n` 就行了，`n` 是允许的最大线程数。

任何时刻，信号量的值都表示还能再进去多少个线程。如果值为 0，下一个线程就会阻塞，直到里面某个线程退出并发出信号。等所有线程都退出后，信号量的值又恢复为 `n`。

由于这个解法是对称的，习惯上只给出代码的一份拷贝，但你应该想象有多份拷贝在多个线程中并发运行。

```python title="Multiplex solution"
multiplex.wait()
    critical section 
multiplex.signal()      
```

如果临界区已经满了，而又来了不止一个线程，会怎样？我们想要的当然是让所有新来的都等待。这个解法正是这么做的。每有一个线程加入队列，信号量就减一，于是信号量的值（取负）就表示排队等待的线程数。

当一个线程离开时，它对信号量发信号，使其加一，从而放行一个正在等待的线程。

再回到比喻：在这个例子里，我觉得把信号量看成一叠令牌（而不是一把锁）更好用。每个线程调用 `wait` 时取走一个令牌，调用 `signal` 时归还一个。只有拿着令牌的线程才能进房间。线程到达时如果没有令牌可用，就得等别的线程归还一个。

现实生活中，售票窗口有时就用这种办法：给排队的顾客发号（有时是扑克筹码），每个号允许持有者买一张票。
:::

## 屏障

再来看前面“会合”一节的问题。我们给出的解法有一个局限：它只能用于两个线程。

**问题**：把会合的解法推广一下。每个线程都运行下面这段代码：

```python title="Barrier code"
rendezvous
critical point
```

同步要求是：在所有线程都执行完 `rendezvous` 之前，任何线程都不得执行 `critical point`。

你可以假设共有 $n$ 个线程，并且这个值保存在变量 `n` 中，所有线程都能访问。

前 $n-1$ 个到达的线程应当阻塞，直到第 $n$ 个线程到达，此时所有线程都可以继续。

::: details 提示：屏障
本书中很多题目，我都会通过给出我在解答里用到的变量、并解释它们的作用来提供提示。

```python title="Barrier hint"
n = the number of threads
count = 0
mutex = Semaphore(1)
barrier = Semaphore(0)
```

`count` 记录已经有多少线程到达。`mutex` 提供对 `count` 的独占访问，使线程可以安全地给它加一。

`barrier` 在所有线程到达之前处于加锁状态（值为 0 或负数）；之后它应当被解锁（值为 1 或更多）。
:::

### 屏障的非解

首先我要给出一个并不完全正确的解答，因为考察错误解法、弄清它错在哪里是很有用的。

```python title="Barrier non-solution"
rendezvous

mutex.wait()
    count = count + 1
mutex.signal()

if count == n: barrier.signal()

barrier.wait()

critical point
```

由于 `count` 由互斥锁保护，它能正确统计通过的线程数。前 $n-1$ 个线程到达屏障时会等待，因为屏障初始是加锁的。第 $n$ 个线程到达时，它把屏障解锁。

**问题**：这个解法有什么问题？

### 死锁 #2

问题在于死锁。

举个例子，假设 $n=5$，有 4 个线程正在屏障处等待。此时信号量的值是排队线程数的相反数，即 -4。

第 5 个线程对屏障发信号后，一个等待的线程被放行，信号量加到 -3。

但此后没有人再对信号量发信号，其余线程都无法通过屏障。这是死锁的第二个例子。

**问题**：这段代码总会造成死锁吗？你能在这段代码中找出一条*不*导致死锁的执行路径吗？

**问题**：修正这个问题。

### 屏障的解法

最后，这是一个能正常工作的屏障：

```python title="Barrier solution"
rendezvous

mutex.wait()
    count = count + 1
mutex.signal()

if count == n: barrier.signal()

barrier.wait()
barrier.signal()

critical point
```

唯一的改动，是在屏障处等待之后再发一次信号。现在每个线程通过时都会对信号量发信号，好让下一个线程也能通过。

这种模式——`wait` 之后紧接着一个 `signal`——出现得足够频繁，所以有个名字：**旋转门**（turnstile）。因为它每次只放一个线程通过，而且可以被锁住以拦住所有线程。

在初始状态（值为 0）下，旋转门是锁住的。第 $n$ 个线程把它解锁，然后全部 $n$ 个线程依次通过。

在互斥锁之外读取 `count` 的值看起来有点危险。在这个例子里它不成问题，但一般说来大概不是个好主意。过几页我们会把它整理干净；在此之前，你可以先想想这两个问题：第 $n$ 个线程通过之后，旋转门处于什么状态？屏障有没有可能被发信号不止一次？

### 死锁 #3

既然同一时刻只有一个线程能通过互斥锁，同一时刻也只有一个线程能通过旋转门，那么把旋转门放进互斥锁里面看起来挺合理，就像这样：

```python title="Bad barrier solution"
rendezvous

mutex.wait()
    count = count + 1
    if count == n: barrier.signal()

    barrier.wait()
    barrier.signal()
mutex.signal()

critical point
```

结果这是个坏主意，因为它可能导致死锁。

设想第一个线程进入互斥锁，然后在旋转门处阻塞。由于互斥锁已被占用，其他线程都进不来，于是 `count==n` 这个条件永远不会成立，也就没人去解锁旋转门。

这里的死锁相当明显，但它揭示了一个常见的死锁来源：**在持有互斥锁的情况下阻塞在信号量上**。

## 可复用屏障

通常，一组协作的线程会在循环中执行一系列步骤，并在每一步之后在屏障处同步。这种应用需要一个**可复用屏障**，它在所有线程通过之后会重新把自己锁上。

**问题**：改写屏障的解法，使所有线程通过之后，旋转门重新锁上。

### 可复用屏障的非解 #1

我们还是从一个简单的尝试开始，然后逐步改进：

```python title="Reusable barrier non-solution"
rendezvous

mutex.wait()
    count += 1
mutex.signal()

if count == n: turnstile.signal()       (*\label{problem}*)

turnstile.wait()
turnstile.signal()

critical point

mutex.wait()
    count -= 1
mutex.signal()

if count == 0: turnstile.wait()         (*\label{problem2}*)
```

注意旋转门之后的代码和之前的代码几乎一样。同样，我们必须用互斥锁保护对共享变量 `count` 的访问。可惜，这段代码并不完全正确。

**问题**：问题出在哪里？

### 可复用屏障的问题 #1

问题出在上一段代码中 `if count == n: turnstile.signal()` 这一行。

如果第 $n-1$ 个线程在这行被中断，接着第 $n$ 个线程穿过互斥锁，那么两个线程都会发现 `count==n`，都会对旋转门发信号。事实上，甚至可能出现*所有*线程都对旋转门发信号的情况。

同样，在 `if count == 0: turnstile.wait()` 这一行，也可能有多个线程执行 `wait`，从而导致死锁。

**问题**：修正这个问题。

### 可复用屏障的非解 #2

这次尝试修正了前面的错误，但还留下一个隐蔽的问题。

```python title="Reusable barrier non-solution"
rendezvous

mutex.wait()
    count += 1
    if count == n: turnstile.signal()
mutex.signal()

turnstile.wait()
turnstile.signal()

critical point

mutex.wait()
    count -= 1
    if count == 0: turnstile.wait()
mutex.signal()
```

两处检查都放进了互斥锁里，这样线程在修改计数器之后、检查计数器之前就不会被打断。

可惜，这段代码*仍然*不正确。记住，这个屏障是放在循环里的。所以执行完最后一行之后，每个线程又会回到会合点。

**问题**：找出问题并修正它。

::: details 提示：可复用屏障
就目前的写法，这段代码允许某个跑得快的线程穿过第二个互斥锁，然后绕回去穿过第一个互斥锁和旋转门，实际上比别的线程多跑了一圈。

要解决这个问题，我们可以用两道旋转门。

```python title="Reusable barrier hint"
turnstile = Semaphore(0)
turnstile2 = Semaphore(1)
mutex = Semaphore(1)
```

一开始第一道是锁住的，第二道是打开的。当所有线程都到达第一道时，我们锁上第二道、打开第一道。当所有线程都到达第二道时，我们重新锁上第一道——这样线程绕回开头就是安全的——然后打开第二道。
:::

::: details 解答：可复用屏障
```python title="Reusable barrier solution"
# rendezvous

mutex.wait()
    count += 1
    if count == n:
        turnstile2.wait()       # lock the second
        turnstile.signal()      # unlock the first
mutex.signal()

turnstile.wait()                # first turnstile
turnstile.signal()

# critical point

mutex.wait()
    count -= 1
    if count == 0: 
        turnstile.wait()         # lock the first
        turnstile2.signal()      # unlock the second
mutex.signal()

turnstile2.wait()                # second turnstile
turnstile2.signal()
```

这个解法有时叫做**两阶段屏障**（two-phase barrier），因为它迫使所有线程等待两次：一次等所有线程到齐，一次等所有线程执行完临界区。

遗憾的是，这个解法在大多数不平凡的同步代码中很典型：很难确信一个解法是正确的。程序某条特定的执行路径往往会以一种隐蔽的方式造成错误。

更糟的是，测试实现的帮助不大。这种错误可能极少发生，因为触发它的那条路径可能需要一系列极其不巧的巧合。这类错误几乎无法用常规手段复现和调试。

唯一的办法是仔细检查代码，“证明”它是正确的。我把“证明”加了引号，因为我并不一定要求你写出形式化的证明（虽然总有那么些狂热分子鼓励这种疯狂举动）。

我心里想的那种证明要随意得多。我们可以利用代码的结构和我们已形成的惯用法，提出并论证若干中间层次的论断。例如：

1.  只有第 $n$ 个线程才能锁上或打开旋转门。

2.  线程在打开第一道旋转门之前，必须先关上第二道，反之亦然；因此一个线程不可能领先其他线程超过一道旋转门。

只要找到合适的论断去陈述和证明，你有时就能用简洁的方式说服自己（或一位持怀疑态度的同事）：你的代码是无懈可击的。
:::

### 预装旋转门

旋转门的一个好处是，它是个多用途的部件，可以用在各种解法里。但它有个缺点：它迫使线程依次通过，这可能造成不必要的上下文切换。

在可复用屏障的解法里，如果解锁旋转门的那个线程预先给旋转门装好足够多的信号、让正确数量的线程通过，我们就可以简化这个解法[^2]。

我这里用的语法假设 `signal` 可以带一个参数，用来指定信号的个数。这是个非标准特性，但用循环很容易实现。唯一要记住的是，多个信号并不是原子的；也就是说，发信号的线程可能在循环中途被打断。不过在这个例子里这不成问题。

```python title="Reusable barrier solution"
# rendezvous

mutex.wait()
    count += 1
    if count == n:
        turnstile.signal(n)      # unlock the first
mutex.signal()

turnstile.wait()                 # first turnstile

# critical point

mutex.wait()
    count -= 1
    if count == 0:
        turnstile2.signal(n)     # unlock the second
mutex.signal()

turnstile2.wait()                # second turnstile
```

第 $n$ 个线程到达时，它给第一道旋转门预装好每个线程一个信号。等第 $n$ 个线程通过旋转门时，它“取走最后一个令牌”，旋转门就又锁上了。

第二道旋转门也是同样的道理：当最后一个线程穿过互斥锁时，它被打开。

### 屏障对象

把屏障封装成对象是很自然的。我借用 Python 定义类的语法：

```python title="Barrier class"
class Barrier:
    def __init__(self, n):
        self.n = n
        self.count = 0
        self.mutex = Semaphore(1)
        self.turnstile = Semaphore(0)
        self.turnstile2 = Semaphore(0)

    def phase1(self):
        self.mutex.wait()
            self.count += 1
            if self.count == self.n:
                self.turnstile.signal(self.n) 
        self.mutex.signal()
        self.turnstile.wait()            

    def phase2(self):
        self.mutex.wait()
            self.count -= 1
            if self.count == 0:
                self.turnstile2.signal(self.n)
        self.mutex.signal()
        self.turnstile2.wait()

    def wait(self):
        self.phase1()
        self.phase2()
```

`__init__` 方法在我们创建新的 `Barrier` 对象时运行，负责初始化实例变量。参数 `n` 是在屏障打开之前必须调用 `wait` 的线程数。

变量 `self` 指方法当前操作的那个对象。由于每个屏障对象都有自己的互斥锁和旋转门，`self.mutex` 指的是当前对象那个特定的互斥锁。

下面是一个创建 `Barrier` 对象并在其上等待的例子：

```python title="Barrier interface"
barrier = Barrier(n)        # initialize a new barrier
barrier.wait()              # wait at a barrier
```

使用屏障的代码也可以选择分别调用 `phase1` 和 `phase2`，如果中间还需要做别的事情的话。

## 队列

信号量也可以用来表示队列。这时初始值为 0，而且通常代码会写成只有在有线程等待时才可能发信号，因此信号量的值永远不会是正数。

例如，设想线程代表舞厅里的舞者，两种舞者——领舞者和随舞者——在进入舞池前分别在两个队列里等待。领舞者到达时，先看看有没有随舞者在等。如果有，两人就都可以继续；否则它就等待。

同样，随舞者到达时，先看看有没有领舞者，然后相应地继续或等待。

**问题**：为领舞者和随舞者写代码，实现这些约束。

::: details 提示：队列
下面是我解答里用到的变量：

```python title="Queue hint"
leaderQueue = Semaphore(0)
followerQueue = Semaphore(0)
```

`leaderQueue` 是领舞者等待的队列，`followerQueue` 是随舞者等待的队列。
:::

::: details 解答：队列
下面是领舞者的代码：

```python title="Queue solution (leaders)"
followerQueue.signal()
leaderQueue.wait()
dance()
```

下面是随舞者的代码：

```python title="Queue solution (followers)"
leaderQueue.signal()
followerQueue.wait()
dance()
```

这个解法简单得不能再简单了，它其实就是一个会合。每个领舞者恰好对一个随舞者发信号，每个随舞者也恰好对一个领舞者发信号，所以能保证领舞者和随舞者成对地获得放行。但他们是否真的成对前进就不清楚了。有可能在任何一个线程执行 `dance` 之前就已经积累了很多线程，因此也可能出现任意多个领舞者先跳完，才有随舞者开始跳。这取决于 `dance` 的语义，也许有问题，也许没有。

为了让问题更有意思，我们再加一个约束：每个领舞者只能与一个随舞者并发地调用 `dance`，反之亦然。换句话说，你只能跟你带来的舞伴跳[^3]。

**问题**：为这个“独占队列”问题写一个解法。
:::

::: details 提示：独占队列
下面是我解答里用到的变量：

```python title="Queue hint"
leaders = followers = 0
mutex = Semaphore(1)
leaderQueue = Semaphore(0)
followerQueue = Semaphore(0)
rendezvous = Semaphore(0)
```

`leaders` 和 `followers` 是计数器，记录各类正在等待的舞者人数。互斥锁保证对计数器的独占访问。

`leaderQueue` 和 `followerQueue` 是舞者等待的队列。`rendezvous` 用来确认双方都跳完了舞。
:::

::: details 解答：独占队列
下面是领舞者的代码：

```python title="Queue solution (leaders)"
mutex.wait()
if followers > 0:
    followers--
    followerQueue.signal()
else:
    leaders++
    mutex.signal()
    leaderQueue.wait()    

dance()
rendezvous.wait()
mutex.signal()
```

领舞者到达时，先取得保护 `leaders` 和 `followers` 的互斥锁。如果有随舞者在等，领舞者就把 `followers` 减一、对一个随舞者发信号，然后调用 `dance`——这一切都在释放 `mutex` 之前完成。这就保证了同一时刻只有一个随舞者线程在运行 `dance`。

如果没有随舞者在等，领舞者必须先交出互斥锁，再去 `leaderQueue` 上等待。

随舞者的代码类似：

```python title="Queue solution (followers)"
mutex.wait()
if leaders > 0:
    leaders--
    leaderQueue.signal()
else:
    followers++
    mutex.signal()
    followerQueue.wait()    

dance()
rendezvous.signal()
```

随舞者到达时，先看看有没有在等的领舞者。如果有，它就把 `leaders` 减一、对一个领舞者发信号，并执行 `dance`，全程都不释放 `mutex`。实际上在这个例子里，随舞者*从不*释放 `mutex`，是领舞者释放的。我们不必记录互斥锁在谁手里，因为我们知道它一定在两者之一手里，而他们中任何一个都可以释放它。在我的解法里，总是领舞者来释放。

当信号量被当作队列使用时[^4]，我觉得把 `wait` 读作“等这个队列”，把 `signal` 读作“从这个队列放一个人走”，会很有帮助。

在这段代码里，除非有人在等，我们从不给队列发信号，所以队列信号量的值很少是正数。不过也有可能。想想看是怎么发生的。

:::

[^1]: 虽然这个比喻眼下很有帮助，但它也可能误导人，正如你将在后面“水”那一节里看到的。
[^2]: 感谢 Matt Tesch 提供这个解法！
[^3]: 一句由 Shania Twain 演唱的歌词。
[^4]: 用作队列的信号量与条件变量非常相似。主要区别在于，线程必须在等待之前显式释放互斥锁，并在之后显式重新获取（但只在需要时才重新获取）。
