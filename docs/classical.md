---
title: "经典同步问题"
---

# 经典同步问题

<div class="chap-en">Classical Synchronization Problems</div>

<div class="chap-en">Classical Synchronization Problems</div>

本章讨论几乎每本操作系统教材都会出现的那些经典问题。它们通常用现实世界中的场景来表述，这样问题的陈述清晰明了，学生也能凭借直觉去理解。

不过，大多数情况下这些问题在现实中并不会真的发生；即便发生了，现实中的解决办法也和我们这里摆弄的这类同步代码相去甚远。

我们之所以关心这些问题，是因为它们与操作系统（以及某些应用程序）需要解决的常见问题相类似。对每个经典问题，我都会先给出经典表述，再解释它与对应的操作系统问题之间的类比关系。

## 生产者-消费者问题

在多线程程序中，线程之间常常有分工。一种常见的模式是：一些线程是生产者，另一些线程是消费者。生产者制造某种数据项并把它们加入某个数据结构；消费者取出这些数据项并处理它们。

事件驱动程序就是一个很好的例子。"事件"指的是发生的、需要程序做出响应的事情：用户按下按键或移动鼠标，从磁盘读到一个数据块，从网络收到一个数据包，某个挂起的操作完成。

每当事件发生，一个生产者线程就创建一个事件对象并把它加入事件缓冲区。与此同时，消费者线程从缓冲区取出事件并处理它们。在这种情况下，消费者被称为"事件处理器"。

要让这个系统正确工作，我们需要满足若干同步约束：

-   在向缓冲区添加数据项或从缓冲区移除数据项的过程中，缓冲区处于不一致状态。因此，线程必须互斥地访问缓冲区。

-   如果消费者线程在缓冲区为空时到达，它必须阻塞，直到某个生产者加入新的数据项。

假设生产者反复执行以下操作：

```python title="Basic producer code"
event = waitForEvent()
buffer.add(event)
```

同时假设消费者反复执行以下操作：

```python title="Basic consumer code"
event = buffer.get()
event.process()
```

如上所述，对缓冲区的访问必须是互斥的，但 `waitForEvent` 和 `event.process` 可以并发执行。

**问题**：给生产者和消费者的代码加上同步语句，以满足上述同步约束。

::: details 提示：生产者-消费者
下面是你可能会用到的变量：

```python title="Producer-consumer initialization"
mutex = Semaphore(1)
items = Semaphore(0)
local event
```

不出所料，`mutex` 提供对缓冲区的互斥访问。当 `items` 为正时，它表示缓冲区中数据项的个数；当它为负时，它表示排队等待的消费者线程数。

`event` 是一个**局部变量**，在这里的意思是每个线程都有自己的一份。到目前为止我们一直假设所有线程都能访问所有变量，但有时把变量绑定到每个线程上会很有用。

在不同的环境里，这可以有多种实现方式：

-   如果每个线程有自己的运行时栈，那么分配在栈上的变量就是该线程私有的。

-   如果线程用对象表示，我们可以给每个线程对象加一个属性。

-   如果线程有唯一的 ID，我们可以用 ID 作为数组或哈希表的下标，在那里存放每个线程的数据。

在大多数程序里，除非另有声明，大多数变量都是局部的；但在本书中大多数变量是共享的，所以我们约定：除非显式声明为 `local`，变量都是共享的。
:::

::: details 解答：生产者-消费者
下面是我的解法中的生产者代码。

```python title="Producer solution"
event = waitForEvent()
mutex.wait()
    buffer.add(event)
    items.signal()
mutex.signal()
```

生产者在拿到事件之前不必独占缓冲区。多个线程可以并发执行 `waitForEvent`。

`items` 信号量记录缓冲区中数据项的个数。生产者每加入一个数据项，就对 `items` 发一次信号，把它加一。

消费者代码与之类似。

```python title="Consumer solution"
items.wait()
mutex.wait()
    event = buffer.get()
mutex.signal()
event.process()
```

同样，缓冲区操作受互斥锁保护，但消费者在访问缓冲区之前必须先对 `items` 减一。如果 `items` 为零或为负，消费者就会阻塞，直到某个生产者发信号。

这个解法虽然正确，但性能上还有一处可以小幅改进。设想生产者对 `items` 发信号时，队列里至少有一个消费者。如果调度器让那个消费者运行，接下来会发生什么？它立刻阻塞在（仍然被生产者持有的）互斥锁上。

阻塞和唤醒都是代价不小的操作，不必要地执行它们会拖累程序性能。所以更好的做法是把生产者改成这样：

```python title="Improved producer solution"
event = waitForEvent()
mutex.wait()
    buffer.add(event)
mutex.signal()
items.signal()
```

现在我们不必去唤醒一个消费者，除非确定它能继续执行（除非碰上另一个生产者抢先拿到互斥锁这种少见情况）。

这个解法还有一点会让较真的人不舒服。在提示里我说过 `items` 信号量记录队列中数据项的个数。但看看消费者代码就会发现：可能有多个消费者先对 `items` 减一，然后才有一个拿到互斥锁并从缓冲区取走数据项。至少在一小段时间里，`items` 是不准确的。

我们也许想在互斥锁内部检查缓冲区来修正这一点：

```python title="Broken consumer solution"
mutex.wait()
    items.wait()
    event = buffer.get()
mutex.signal()
event.process()
```

这是个坏主意。

**问题**：为什么？
:::

### 死锁 #4

如果消费者运行的是这段代码

```python title="Broken consumer solution"
mutex.wait()
    items.wait()
    event = buffer.get()
mutex.signal()

event.process()
```

就会导致死锁。设想缓冲区为空。一个消费者到达，拿到互斥锁，然后阻塞在 `items` 上。生产者到达后阻塞在 `mutex` 上，整个系统就此彻底停摆。

这是同步代码中常见的错误：只要你在持有互斥锁的时候等待另一个信号量，就有死锁的危险。检查一个同步问题的解法时，一定要检查这类死锁。

## 带有限缓冲区的生产者-消费者

上面我举的事件处理线程的例子中，共享缓冲区通常是无限的（更准确地说，它受物理内存和交换空间等系统资源的限制）。

但在操作系统内核里，可用空间是有限的。磁盘请求、网络数据包之类的缓冲区通常是固定大小的。在这类情况下，我们多了一条同步约束：

-   如果生产者在缓冲区已满时到达，它必须阻塞，直到某个消费者取走一个数据项。

假设我们知道缓冲区的大小，记为 `bufferSize`。既然已经有一个信号量在记录数据项的个数，就很想写出这样的代码：

```python title="Broken finite buffer solution"
if items >= bufferSize:
    block()
```

但我们不能这么做。记住，我们无法读取信号量的当前值；能做的操作只有 `wait` 和 `signal`。

**问题**：写出能处理有限缓冲区约束的生产者-消费者代码。

::: details 提示：有限缓冲区生产者-消费者
再加一个信号量，用来记录缓冲区中可用空位的个数。

```python title="Finite-buffer producer-consumer initialization"
mutex = Semaphore(1)
items = Semaphore(0)
spaces = Semaphore(buffer.size())
```

消费者取走一个数据项时，应当对 `spaces` 发信号。生产者到达时，应当对 `spaces` 减一，此时它可能会阻塞，直到下一个消费者发信号。
:::

::: details 解答：有限缓冲区生产者-消费者
下面是一个解法。

```python title="Finite buffer consumer solution"
items.wait()
mutex.wait()
    event = buffer.get()
mutex.signal()
spaces.signal()

event.process()
```

生产者代码在某种意义上是对称的：

```python title="Finite buffer producer solution"
event = waitForEvent()

spaces.wait()
mutex.wait()
    buffer.add(event)
mutex.signal()
items.signal()
```

为了避免死锁，生产者和消费者都在获取互斥锁之前检查可用性。为了获得最佳性能，它们在发信号之前释放互斥锁。
:::

## 读者-写者问题

下一个经典问题叫作读者-写者问题，它适用于任何"数据结构、数据库或文件系统被并发线程读取和修改"的场景。当数据结构正在被写入或修改时，往往必须阻止其他线程读取，以免某个读者打断进行中的修改，读到不一致或无效的数据。

与生产者-消费者问题一样，解法是非对称的。读者和写者在进入临界区之前执行不同的代码。同步约束是：

1.  任意数量的读者可以同时处于临界区。

2.  写者必须互斥地访问临界区。

换句话说，只要临界区里还有别的线程（读者或写者），写者就不能进入；而写者在里面的时候，其他任何线程都不得进入。

这里的排斥模式可以称为**按类互斥**。临界区中的某个线程并不一定排斥其他线程，但某一类线程在临界区中，就会排斥其他类别的线程。

**问题**：用信号量实现这些约束，同时允许读者和写者访问数据结构，并避免死锁的可能。

::: details 提示：读者-写者
下面这组变量足以解决这个问题。

```python title="Readers-writers initialization"
int readers = 0
mutex = Semaphore(1)
roomEmpty = Semaphore(1)
```

计数器 `readers` 记录房间里有几个读者。`mutex` 保护这个共享计数器。

如果临界区里没有线程（无论读者还是写者），`roomEmpty` 就是 1，否则为 0。这体现了我在给"表示条件"的信号量命名时的习惯：在这套习惯里，"wait"通常表示"等待条件成立"，"signal"表示"宣告条件成立"。
:::

::: details 解答：读者-写者
写者的代码很简单。如果临界区为空，写者就可以进入，而进入的效果是排斥所有其他线程：

```python title="Writers solution"
roomEmpty.wait()
    critical section for writers
roomEmpty.signal()
```

写者退出时，能确定房间现在是空的吗？能，因为它知道自己待在里面的时候不可能有其他线程进入。

读者的代码和上一节看到的屏障代码类似。我们记录房间里的读者数，以便给第一个到达者和最后一个离开者分配特殊任务。

第一个到达的读者必须等待 `roomEmpty`。如果房间是空的，这个读者就继续执行，同时也把写者挡在外面。后续的读者仍然可以进入，因为它们都不会去等待 `roomEmpty`。

如果读者到达时有写者在房间里，它就会在 `roomEmpty` 上等待。由于它持有互斥锁，后续的读者都会在 `mutex` 上排队。

```python title="Readers solution"
mutex.wait()
    readers += 1
    if readers == 1:
        roomEmpty.wait()     # first in locks
mutex.signal()

# critical section for readers

mutex.wait()
    readers -= 1
    if readers == 0:
        roomEmpty.signal()   # last out unlocks
mutex.signal()
```

临界区之后的代码与之类似。最后一个离开房间的读者负责关灯——也就是说，它对 `roomEmpty` 发信号，这可能让某个等待的写者进入。

同样，为了说明这段代码是正确的，断言并证明程序行为的若干性质是很有用的。你能说服自己下面这些结论成立吗？

-   只能有一个读者排队等待 `roomEmpty`，但可能有多个写者在排队。

-   当读者对 `roomEmpty` 发信号时，房间必定是空的。

与这段读者代码类似的模式很常见：第一个进入某区域的线程锁定一个信号量（或排队），最后一个离开的线程解锁它。事实上，它常见到我们应该给它起个名字，并封装成一个对象。

这个模式叫 **Lightswitch**（电灯开关），类比的是这样一幅图景：第一个人进屋时开灯（锁住互斥锁），最后一个人离开时关灯（解锁互斥锁）。下面是 Lightswitch 的类定义：

```python title="Lightswitch definition"
class Lightswitch:
    def __init__(self):
        self.counter = 0
        self.mutex = Semaphore(1)

    def lock(self, semaphore):
        self.mutex.wait()
            self.counter += 1
            if self.counter == 1:
                semaphore.wait()
        self.mutex.signal()

    def unlock(self, semaphore):
        self.mutex.wait()
            self.counter -= 1
            if self.counter == 0:
                semaphore.signal()
        self.mutex.signal()
```

`lock` 接收一个参数，即它要检查并可能持有的信号量。如果该信号量已被锁住，调用线程就会阻塞在 `semaphore` 上，而所有后续线程阻塞在 `self.mutex` 上。当信号量被解锁时，第一个等待的线程重新锁住它，所有等待的线程继续执行。

如果信号量初始是未锁的，第一个线程会锁住它，后续线程则直接通过。

`unlock` 在所有调用过 `lock` 的线程都调用 `unlock` 之前不起作用。当最后一个线程调用 `unlock` 时，它解锁该信号量。

利用这些函数，我们可以更简洁地重写读者代码：

```python title="Readers-writers initialization"
readLightswitch = Lightswitch()
roomEmpty = Semaphore(1)
```

`readLightswitch` 是一个共享的 `Lightswitch` 对象，其计数器初始为零。

```python title="Readers-writers solution (reader)"
readLightswitch.lock(roomEmpty)
# critical section
readLightswitch.unlock(roomEmpty)
```

写者的代码不变。

也可以把 `roomEmpty` 的引用存为 Lightswitch 的属性，而不是作为参数传给 `lock` 和 `unlock`。那种做法更不容易出错，但我认为每次调用 `lock` 和 `unlock` 都指明它操作的信号量，可读性更好。
:::

### 饥饿

上面的解法有死锁的危险吗？要发生死锁，必须存在这样的情况：一个线程在持有某个信号量的同时等待另一个信号量，从而使自己永远等不到信号。

在这个例子里死锁不可能发生，但有一个几乎同样糟糕的相关问题：写者可能会饿死。

如果写者在读者处于临界区时到达，它可能永远排队等待，而读者来来去去。只要在当前这批读者全部离开之前又有新读者到达，房间里就始终至少有一个读者。

这种情况不是死锁，因为有些线程在推进，但它显然不是我们想要的。系统负载低的时候这样的程序也许还能用，因为那时写者有很多机会。但随着负载增加，系统的行为会迅速恶化（至少从写者的角度看是这样）。

**问题**：扩展这个解法，使得写者到达时，已有的读者可以读完，但不再允许新的读者进入。

::: details 提示：无饥饿读者-写者
提示如下。你可以给读者加一扇旋转门，并允许写者锁住它。写者也要通过同一扇旋转门，但它们应该在旋转门内部检查 `roomEmpty` 信号量。如果写者卡在旋转门里，效果就是迫使读者在旋转门处排队。这样当最后一个读者离开临界区时，我们就能保证至少有一个写者接下来进入（在任何排队的读者通过之前）。

```python title="No-starve readers-writers initialization"
readSwitch = Lightswitch()
roomEmpty = Semaphore(1)
turnstile = Semaphore(1)
```

`readSwitch` 记录房间里有几个读者；它在第一个读者进入时锁住 `roomEmpty`，在最后一个读者退出时解锁它。

`turnstile` 对读者是旋转门，对写者则是互斥锁。
:::

::: details 解答：无饥饿读者-写者
写者代码如下：

```python title="No-starve writer solution"
turnstile.wait()
    roomEmpty.wait()           (* \label{stuck} *)
    # critical section for writers
turnstile.signal()

roomEmpty.signal()
```

如果写者在读者还在房间里时到达，它会阻塞在标有 stuck 的那一行，这意味着旋转门被锁住了。这将在写者排队期间阻止读者进入。读者代码如下：

```python title="No-starve reader solution"
turnstile.wait()
turnstile.signal()

readSwitch.lock(roomEmpty)
    # critical section for readers
readSwitch.unlock(roomEmpty)
```

最后一个读者离开时对 `roomEmpty` 发信号，唤醒等待的写者。写者立即进入自己的临界区，因为等待的读者都无法通过旋转门。

写者退出时对 `turnstile` 发信号，唤醒一个等待的线程，它可能是读者，也可能是写者。因此这个解法保证至少有一个写者能推进，但仍有可能在写者排队时让某个读者进入。

取决于具体应用，给写者更高的优先级也许是好主意。例如，如果写者正在对数据结构做时间敏感的更新，那么最好尽量减少写者有机会推进之前读到旧数据的读者数量。

不过一般来说，选择唤醒哪个等待线程是调度器的事，而不是程序员的事。有些调度器使用先进先出队列，也就是按排队的顺序唤醒线程；其他调度器随机选择，或者根据等待线程的属性按优先级方案选择。

如果你的编程环境能给某些线程比别的线程更高的优先级，那就是解决这个问题的一个简单办法。如果不能，你就得另想办法。

**问题**：写出一个给写者优先级的读者-写者解法。也就是说，一旦有写者到达，在所有写者离开系统之前，不允许任何读者进入。
:::

::: details 提示：写者优先的读者-写者
照例，提示以解法中用到的变量形式给出。

```python title="Writer-priority readers-writers initialization"
readSwitch = Lightswitch()
writeSwitch = Lightswitch()
noReaders = Semaphore(1)
noWriters = Semaphore(1)
```
:::

::: details 解答：写者优先的读者-写者
读者代码如下：

```python title="Writer-priority reader solution"
noReaders.wait()
    readSwitch.lock(noWriters)
noReaders.signal()

    # critical section for readers

readSwitch.unlock(noWriters)
```

如果读者在临界区里，它持有 `noWriters`，但并不持有 `noReaders`。因此写者到达时可以锁住 `noReaders`，这会让后续的读者排队。

最后一个读者退出时对 `noWriters` 发信号，允许排队的写者继续。

写者代码如下：

```python title="Writer-priority writer solution"
writeSwitch.lock(noReaders)
    noWriters.wait()
        # critical section for writers
    noWriters.signal()
writeSwitch.unlock(noReaders)
```

写者在临界区里的时候同时持有 `noReaders` 和 `noWriters`。这有（比较明显的）效果：确保临界区里既没有读者也没有其他写者。此外，`writeSwitch` 还有一个（不那么明显的）效果：允许多个写者在 `noWriters` 上排队，同时只要他们还在，`noReaders` 就一直保持锁定。于是许多写者可以接连穿过临界区，而始终不必对 `noReaders` 发信号。只有最后一个写者退出后，读者才能进入。

当然，这个解法的缺点是现在*读者*可能饿死（或者至少面临长时间延迟）。对某些应用来说，宁可拿到过时的数据，也要有可预测的周转时间。
:::

## 无饥饿互斥

上一节我们处理了我称之为**按类饥饿**的问题：某一类线程（读者）使另一类线程（写者）饿死。在更基础的层面上，我们还必须处理**线程饥饿**问题，也就是某个线程可能在别的线程不断推进时无限期地等待下去。

对大多数并发应用来说，饥饿是不可接受的，所以我们要求**有界等待**（bounded waiting），意思是线程在信号量上（或者任何其他地方）等待的时间必须可以证明是有限的。

饥饿在一定程度上是调度器的责任。只要有多线程就绪，调度器就决定让哪一个、或者在并行处理器上让哪一组线程运行。如果一个线程永远得不到调度，那么无论我们怎么用信号量，它都会饿死。

所以，要对饥饿说点什么，我们必须先对调度器做一些假设。如果我们愿意做一个很强的假设，可以假设调度器使用某种能够证明满足有界等待的算法。如果我们不知道调度器用的是什么算法，那就可以退而使用一个更弱的假设：

> 性质 1：如果只有一个线程就绪，调度器必须让它运行。

如果能假设性质 1，我们就能构造出可证明无饥饿的系统。例如，若线程数有限，那么任何含有屏障的程序都不会饿死，因为最终除一个线程外的所有线程都会在屏障处等待，此时最后一个线程必须运行。

不过一般来说，除非我们做更强的假设，写出无饥饿的程序并不容易：

> 性质 2：如果线程就绪，那么它等到运行的时间是有界的。

在目前的讨论中，我们一直隐含地假设性质 2，以后也会继续这样假设。另一方面，你应该知道许多现有系统使用的调度器并不严格保证这一性质。

即便有性质 2，一旦引入信号量，饥饿又会冒出来。在信号量的定义里我们说，当一个线程执行 `signal` 时，会唤醒一个等待的线程。但我们从没说是哪一个。要对饥饿做出论断，我们必须对信号量的行为做假设。

能避免饥饿的最弱假设是：

> 性质 3：如果在线程执行 `signal` 时有线程在信号量上等待，那么必须唤醒其中一个等待的线程。

这个要求看起来理所当然，但并不平凡。它的效果是排除一种有害行为：某个线程在别的线程等待时对信号量发信号，然后继续运行，再等待同一个信号量，结果等到了自己发的信号！如果这都可能，那我们就无论如何都无法防止饥饿了。

有了性质 3，避免饥饿就成为可能，但即便对互斥锁这么简单的东西也不容易。例如，设想三个线程运行下面的代码：

```python title="Mutex loop"
while True:
    mutex.wait()
    # critical section 
    mutex.signal()
```

`while` 语句是无限循环；换句话说，线程一离开临界区就回到循环开头，再次尝试获取互斥锁。

设想线程 A 拿到互斥锁，B 和 C 等待。A 离开后 B 进入，但 B 还没离开，A 就绕回来和 C 一起排队。B 离开时，没有谁能保证下一个是 C。事实上，如果下一个是 A，而 B 又加入队列，我们就回到了初始状态，可以永远重复这个循环。C 饿死了。

这个模式的存在证明互斥锁是可能饥饿的。一个解决办法是修改信号量的实现，让它保证更强的性质：

> 性质 4：如果线程在信号量上等待，那么在它之前被唤醒的线程数量是有界的。

例如，如果信号量维护一个先进先出队列，性质 4 就成立，因为线程入队时它前面的线程数是有限的，而后来的线程不可能插到它前面。

满足性质 4 的信号量有时称为**强信号量**；只满足性质 3 的称为**弱信号量**。我们已经说明，使用弱信号量时，简单的互斥锁解法可能饥饿。事实上，Dijkstra 曾猜想：只用弱信号量不可能解决无饥饿的互斥问题。

1979 年，J.M. Morris 在假设线程数有限的前提下解决了这个问题，从而推翻了该猜想 [@morris]。如果你对这个题目感兴趣，下一节会给出他的解法。如果你觉得这不算好玩，那就直接假设信号量满足性质 4，跳到「哲学家就餐」一节。

**问题**：用弱信号量写出互斥问题的解法。你的解法应当保证：一旦某个线程到达并试图进入互斥区，能在它之前推进的线程数量是有界的。你可以假设线程总数有限。

### 无饥饿互斥提示 {#morris}

Morris 的解法类似于前面讲过的可复用屏障。它用两扇旋转门在临界区之前造出两个等候室。这套机制分两个阶段工作。第一阶段，第一扇门打开、第二扇门关闭，于是线程在第二个房间里聚集。第二阶段，第一扇门关闭，不再有新线程进入；第二扇门打开，已有的线程可以前往临界区。

虽然等候室里可能有任意多的线程，但每一个都保证能在任何后来的线程之前进入临界区。

下面是我在解法中使用的变量（我改了 Morris 用的名字，想让结构更清楚些）。

```python title="No-starve mutex hint"
room1 = room2 = 0
mutex = Semaphore(1)
t1 = Semaphore(1)
t2 = Semaphore(0)
```

`room1` 和 `room2` 记录各等候室里的线程数。`mutex` 帮助保护计数器。`t1` 和 `t2` 是两扇旋转门。

::: details 解答：无饥饿互斥
这是 Morris 的解法。

```python title="Morris's algorithm"
mutex.wait()
    room1 += 1            (*\label{room1begin}*)
mutex.signal()
                           
t1.wait()                 (*\label{wait1}*)
    room2 += 1            (*\label{room2begin}*)
    mutex.wait()
    room1 -= 1            (*\label{room1end}*)

    if room1 == 0: 
        mutex.signal()
    t2.signal()
    else: 
        mutex.signal()
    t1.signal()

t2.wait()                  (*\label{wait2}*)
    room2 -= 1             (*\label{room2end}*)

    # critical section

    if room2 == 0:
        t1.signal()
    else:
        t2.signal()
```

在进入临界区之前，线程必须通过两扇旋转门。这两扇门把代码分成三个"房间"。房间 1 是从 room1begin 到 room1end 的那几行。房间 2 是从 room2begin 到 room2end 的那几行。房间 3 是其余部分。粗略地说，计数器 `room1` 和 `room2` 记录每个房间里的线程数。

计数器 `room1` 按常规方式由 `mutex` 保护，但 `room2` 的守卫职责由 `t1` 和 `t2` 分担。同样，临界区的互斥访问也同时涉及 `t1` 和 `t2`。为了进入临界区，线程必须持有其中之一，但不能同时持有两个。然后在退出之前，它交还自己所持有的那一个。

要理解这个解法如何工作，先跟着一个线程走完全程。当它到达 room1end 那一行时，它持有 `mutex` 和 `t1`。一旦它检查到 `room1` 为 0，它就可以释放 `mutex`，然后打开第二扇门 `t2`。结果它不会在 wait2 那一行等待，可以安全地对 `room2` 减一并进入临界区，因为后面来的线程都必须在 `t1` 上排队。离开临界区时，它发现 `room2 = 0`，于是释放 `t1`，这就回到了初始状态。

当然，如果有不止一个线程，情况会更有意思。这时可能发生：领头的线程到达 room1end 那一行时，其他线程已经进入等候室并在 `t1` 上排队。由于 `room1 > 0`，领头的线程让 `t2` 保持锁定，转而对 `t1` 发信号，让后面的一个线程进入房间 2。由于 `t2` 仍然锁着，两个线程都进不了房间 3。

最终（因为线程数有限），总会有某个线程在另一个线程进入房间 1 之前到达 room1end 那一行，这时它会打开 `t2`，让那里的线程进入房间 3。打开 `t2` 的线程继续持有 `t1`，所以如果哪个领头的线程绕回来，就会阻塞在 wait1 那一行。

每个线程离开房间 3 时对 `t2` 发信号，让另一个线程离开房间 2。当最后一个线程离开房间 2 时，它让 `t2` 保持锁定并打开 `t1`，于是回到初始状态。

要看出这个解法为什么不会饥饿，可以把它分两个阶段来想。第一阶段，线程在房间 1 登记、把 `room1` 加一，然后一个接一个地涌入房间 2。要让 `t2` 一直锁着，唯一的办法是让线程源源不断地经过房间 1。由于线程数有限，这股人流终究会结束，此时 `t1` 保持锁定而 `t2` 打开。

第二阶段，线程涌入房间 3。由于房间 2 里的线程数有限，且没有新线程能进入，最终最后一个线程也会离开，此时 `t2` 锁定而 `t1` 打开。

第一阶段结束时，我们知道没有线程在 `t1` 上等待，因为 `room1 = 0`。第二阶段结束时，我们知道没有线程在 `t2` 上等待，因为 `room2 = 0`。

在线程数有限的情况下，只有当某个线程能绕回来并超过另一个线程时，饥饿才可能发生。而两扇旋转门的机制使这不可能，所以饥饿不可能发生。

这个故事的寓意是：使用弱信号量时，即便对最简单的同步问题，防止饥饿也极其困难。在本书余下的部分，讨论饥饿时我们都假设信号量是强信号量。
:::

## 哲学家就餐

哲学家就餐问题由 Dijkstra 于 1965 年提出，那时恐龙还统治着地球 [@dijkstra65]。它有许多变体，但标准配置是一张桌子、五个盘子、五把叉子（或筷子）和一大碗意大利面。五位哲学家代表相互作用的线程，他们来到桌边，执行下面的循环：

```python title="Basic philosopher loop"
while True:
   think()
   get_forks()
   eat()
   put_forks()
```

叉子代表线程为了推进而必须独占的资源。这个问题之所以有趣、不现实而且不卫生，是因为哲学家需要*两把*叉子才能吃，所以一个饥饿的哲学家可能得等邻居放下叉子。

假设哲学家有一个局部变量 `i`，取值在 $(0..4)$ 中，用来标识每位哲学家。同样，叉子从 0 到 4 编号，于是哲学家 $i$ 右边是叉子 $i$，左边是叉子 $i+1$。下图是场景示意：

<figure class="book-figure">
<img src="/figures/dining.svg" alt="哲学家就餐圆桌" loading="lazy">
<figcaption><span class="fig-label">图 1</span>哲学家就餐：五人围坐，两两之间放一把叉子</figcaption>
</figure>

假设哲学家知道怎么 `think` 和 `eat`，我们的任务是写出满足以下约束的 `get_forks` 和 `put_forks`：

-   一次只能有一位哲学家持有一把叉子。

-   必须不可能发生死锁。

-   必须不可能有哲学家因等待叉子而饿死。

-   必须可能有多位哲学家同时进食。

最后一条要求是在说解法应当高效，也就是应当允许最大程度的并发。

我们不对 `eat` 和 `think` 耗时做任何假设，只要求 `eat` 最终会结束。否则第三条约束就不可能满足——如果某位哲学家永远攥着一把叉子，那就没有任何办法阻止邻居饿死。

为了方便哲学家引用自己的叉子，我们可以用 `left` 和 `right` 两个函数：

```python title="Which fork?"
def left(i): return i
def right(i): return (i + 1) % 5
```

`%` 运算符到 5 就绕回 0，所以 `(4 + 1) % 5 = 0`。

既然必须保证叉子的互斥访问，自然可以用一个信号量列表，每把叉子一个。初始时所有叉子都可用。

```python title="Variables for dining philosophers"
forks = [Semaphore(1) for i in range(5)]
```

不用 Python 的读者可能不熟悉这种初始化列表的写法。`range` 函数返回含 5 个元素的列表；对其中每个元素，Python 创建一个初值为 1 的信号量，并把结果组装成一个名为 `forks` 的列表。

下面是对 `get_fork` 和 `put_fork` 的初次尝试：

```python title="Dining philosophers non-solution"
def get_forks(i):
    fork[right(i)].wait()
    fork[left(i)].wait()

def put_forks(i):
    fork[right(i)].signal()
    fork[left(i)].signal()
```

显然这个解法满足第一条约束，但我们可以相当肯定它不满足另外两条，否则这就不是一个有趣的问题，你现在读的就会是下一节了。

**问题**：哪里不对？

### 死锁 #5

问题在于桌子是圆的。结果每位哲学家都可能拿起一把叉子，然后永远等待另一把。死锁！

**问题**：写出一个能防止死锁的解法。

提示：避免死锁的一种思路是想想使死锁成为可能的那些条件，然后改变其中一个。在这个例子里，死锁相当脆弱——一点点改动就能打破它。

### 哲学家就餐提示 #1

如果一次只允许四位哲学家上桌，死锁就不可能发生。

先说服自己这个论断是对的，然后写出限制桌上哲学家数量的代码。

### 哲学家就餐解法 #1

如果桌上只有四位哲学家，那么在最坏情况下每人拿起一把叉子。即便如此，桌上还会剩下一把叉子，而这把叉子有两个邻居，每个邻居都还拿着另一把叉子。因此其中任何一个邻居都可以拿起剩下的那把叉子进食。

我们可以用一个名为 `footman` 的 Multiplex（复用信号量）来控制上桌的哲学家数量，初值设为 4。于是解法如下：

```python title="Dining philosophers solution \\#1"
def get_forks(i):
    footman.wait()
    fork[right(i)].wait()
    fork[left(i)].wait()

def put_forks(i):
    fork[right(i)].signal()
    fork[left(i)].signal()
    footman.signal()
```

除了避免死锁，这个解法还保证没有哲学家会饿死。设想你坐在桌边，两个邻居都在吃。你阻塞在等右手的叉子上。由于 `eat` 不会永远进行，右邻居最终会放下叉子。既然你是唯一等待那把叉子的线程，你必定下一个拿到它。同理，你也不会因为等左手叉子而饿死。

因此，哲学家在桌边停留的时间是有界的。这意味着进入房间的等待时间也是有界的，只要 `footman` 满足性质 4（见前面关于信号量性质的那一节）。

这个解法说明，通过控制哲学家数量可以避免死锁。另一种避免死锁的办法是改变哲学家拿起叉子的顺序。在最初那个错误解法里，哲学家都是"右撇子"，也就是先拿右边的叉子。但如果 0 号哲学家是左撇子，会怎样呢？

**问题**：证明只要至少有一个左撇子和至少有一个右撇子，死锁就不可能发生。

提示：只有当 5 位哲学家都拿着一把叉子、永远等待另一把时，死锁才会发生。否则其中总有人能拿到两把叉子，吃完离开。

证明用反证法。首先假设死锁可能发生。然后任选一位假想中处于死锁的哲学家。如果她是左撇子，你可以证明所有哲学家都是左撇子，这与"至少有一个右撇子"矛盾。同样，如果她是右撇子，你可以证明所有人都是右撇子。无论哪种情况都得到矛盾；因此死锁不可能发生。

### 哲学家就餐解法 #2

在哲学家就餐问题的非对称解法中，桌上至少要有一个左撇子和一个右撇子。此时死锁不可能发生。前面的提示勾勒了证明，下面是细节。

同样，如果死锁可能，它发生在 5 位哲学家都拿着一把叉子等待另一把的时候。假设哲学家 $j$ 是左撇子，那么她必定拿着左手的叉子、等待右手的叉子。于是她右边的邻居，哲学家 $k$，必定拿着他左手的叉子、等待他右边的邻居；换句话说，哲学家 $k$ 必定也是左撇子。重复同样的论证，我们可以证明所有哲学家都是左撇子，这与"至少有一个右撇子"矛盾。因此死锁不可能发生。

我们用于上一个解法的论证同样可以证明这个解法不会饥饿。

::: details 解答：Tanenbaum 的解法
前面的解法没什么问题，但为了完整起见，我们来看看一些替代方案。最著名的一个出现在 Tanenbaum 那本流行的操作系统教材里 [@tanenbaum]。对每位哲学家有一个状态变量，表示他是在思考、进食，还是在等待进食（"饥饿"），另外还有一个信号量表示他是否可以开始进食。变量如下：

```python title="Variables for Tanenbaum's solution"
state = ['thinking'] * 5
sem = [Semaphore(0) for i in range(5)]
mutex = Semaphore(1)
```

`state` 的初值是 5 个 `'thinking'` 组成的列表。`sem` 是 5 个初值为 0 的信号量组成的列表。代码如下：

```python title="Tanenbaum's solution"
def get_fork(i):
    mutex.wait()
    state[i] = 'hungry'
    test(i)
    mutex.signal()
    sem[i].wait()

def put_fork(i):
    mutex.wait()
    state[i] = 'thinking'
    test(right(i))
    test(left(i))
    mutex.signal()

def test(i):
    if state[i] == 'hungry' and
    state[left (i)]  != 'eating' and
    state[right (i)] != 'eating':
        state[i] = 'eating'
        sem[i].signal()
```

`test` 函数检查第 $i$ 位哲学家能否开始进食：如果他饿了，而且两个邻居都没在吃，他就可以。如果可以，`test` 就对信号量 $i$ 发信号。

哲学家吃上饭有两条路径。第一种情况，哲学家执行 `get_forks`，发现叉子可用，立即继续。第二种情况，某个邻居正在吃，哲学家在自己的信号量上阻塞。最终有个邻居会吃完，此时它对自己的两个邻居都执行 `test`。有可能两个测试都成功，那样两个邻居就能并发运行。两个测试的顺序无关紧要。

要访问 `state` 或调用 `test`，线程必须持有 `mutex`。因此检查和更新数组的操作是原子的。由于只有在我们知道两把叉子都可用时哲学家才能继续，对叉子的互斥访问得到了保证。

死锁不可能发生，因为被一位以上哲学家访问的信号量只有 `mutex`，而没有线程在持有 `mutex` 时执行 `wait`。

但饥饿仍然棘手。

**问题**：要么说服自己 Tanenbaum 的解法能防止饥饿，要么找出一个重复模式，使某个线程在别的线程推进时饿死。
:::

### Tanenbaum 解法的饥饿

遗憾的是，这个解法并非无饥饿。Gingras 证明存在重复模式，使某个线程永远等待而其他线程来来去去 [@gingras90dining]。

设想我们想让 0 号哲学家饿死。初始时 2 号和 4 号在桌边，1 号和 3 号饿了。设想 2 号起身、1 号坐下；然后 4 号起身、3 号坐下。现在局面是初始状态的镜像。

如果 3 号起身、4 号坐下，然后 1 号起身、2 号坐下，我们就回到了起点。我们可以无限重复这个循环，0 号哲学家就会饿死。

所以，Tanenbaum 的解法并不满足所有要求。

## 吸烟者问题

吸烟者问题最初由 Suhas Patil 提出 [@patil]，他声称这个问题无法用信号量解决。这个论断是有前提条件的，但无论如何，这个问题既有意思又有挑战性。

涉及四个线程：一个代理和三个吸烟者。吸烟者永远循环：先等待原料，然后卷烟、吸烟。原料是烟草、纸和火柴。

我们假设代理拥有全部三种原料的无限供应，而每个吸烟者拥有其中一种原料的无限供应；也就是说，一个吸烟者有火柴，另一个有纸，第三个有烟草。

代理反复随机选取两种不同的原料，把它们提供给吸烟者。根据所选原料的不同，拥有互补原料的吸烟者应当拿起这两样资源并继续。

例如，如果代理放出烟草和纸，拥有火柴的吸烟者就应当拿起这两样原料，卷一支烟，然后对代理发信号。

为了说明这个前提的含义：代理代表分配资源的操作系统，吸烟者代表需要资源的应用程序。问题是要确保：如果现有资源足以让一个或多个应用推进，这些应用就应当被唤醒。反过来，我们也不想唤醒无法推进的应用。

基于这个前提，教科书里常见的有三个版本：

**不可能版本**

Patil 的版本对解法施加了限制。首先，不允许修改代理的代码。如果代理代表操作系统，那么假设你不希望每来一个新应用就改它一次，这是合理的。第二个限制是不能使用条件语句，也不能使用信号量数组。在这些约束下问题无法解决，但正如 Parnas 指出的，第二个限制相当人为 [@Parnas]。有这种约束，很多问题都会变得不可解。

**有趣版本**

这个版本保留了第一个限制——不能改代理的代码——但去掉了其他限制。

**平凡版本**

有些教材里，问题规定代理应当根据现有原料，对接下来该行动的吸烟者发信号。这个版本没意思，因为它让整个前提——原料和香烟——变得无关紧要。而且从实践角度看，要求代理了解其他线程以及它们在等什么，大概也不是个好主意。最后，这个版本太简单了。

自然，我们关注的是有趣版本。为了完整陈述问题，我们需要指定代理的代码。代理使用以下信号量：

```python title="Agent semaphores"
agentSem = Semaphore(1)
tobacco = Semaphore(0)
paper = Semaphore(0)
match = Semaphore(0)
```

代理实际上由三个并发线程组成：代理 A、代理 B 和代理 C。每个都在 `agentSem` 上等待；每次 `agentSem` 被发信号，就有一个代理醒来，通过对两个信号量发信号来提供原料。

```python title="Agent A code"
agentSem.wait()
tobacco.signal()
paper.signal()
```

```python title="Agent B code"
agentSem.wait()
paper.signal()
match.signal()
```

```python title="Agent C code"
agentSem.wait()
tobacco.signal()
match.signal()
```

这个问题难就难在自然的解法行不通。人们很想写成这样：

```python title="Smoker with matches"
tobacco.wait()
paper.wait()
agentSem.signal()
```

```python title="Smoker with tobacco"
paper.wait()
match.wait()
agentSem.signal()
```

```python title="Smoker with paper"
tobacco.wait()
match.wait()
agentSem.signal()
```

这个解法有什么问题？

### 死锁 #6

上一个解法的问题在于可能死锁。设想代理放出烟草和纸。由于有火柴的吸烟者在等待 `tobacco`，它可能被唤醒。但有烟草的吸烟者在等待 `paper`，所以它也可能（甚至很可能）被唤醒。然后第一个线程阻塞在 `paper` 上，第二个阻塞在 `match` 上。死锁！

::: details 提示：吸烟者问题
Parnas 提出的解法使用三个称为"推手"（pusher）的辅助线程，它们响应代理的信号，记录现有原料，并对相应的吸烟者发信号。

新增的变量和信号量是

```python title="Smokers problem hint"
isTobacco = isPaper = isMatch = False
tobaccoSem = Semaphore(0)
paperSem = Semaphore(0)
matchSem = Semaphore(0)
```

布尔变量表示某种原料是否在桌上。推手用 `tobaccoSem` 对有烟草的吸烟者发信号，其他信号量同理。
:::

::: details 解答：吸烟者问题
下面是其中一个推手的代码：

```python title="Pusher A"
tobacco.wait()
mutex.wait()
    if isPaper:
        isPaper = False
        matchSem.signal()
    elif isMatch:
        isMatch = False
        paperSem.signal()
    else: 
        isTobacco = True
mutex.signal()
```

只要桌上有烟草，这个推手就会醒来。如果它发现 `isPaper` 为真，就知道推手 B 已经运行过，于是可以对有火柴的吸烟者发信号。同理，如果它发现桌上有火柴，就可以对有纸的吸烟者发信号。

但如果推手 A 先运行，它就会发现 `isPaper` 和 `isMatch` 都是假。它无法对任何吸烟者发信号，于是把 `isTobacco` 置为真。

其他推手类似。由于推手干了所有实际的活，吸烟者的代码很简单：

```python title="Smoker with tobacco"
tobaccoSem.wait()
makeCigarette()
agentSem.signal()
smoke()
```

Parnas 给出了一个类似的解法，把布尔变量按位拼成一个整数，再用这个整数作为信号量数组的下标。这样他就避开了条件语句（那一条人为约束）。得到的代码更简洁一些，但功能不那么直观。
:::

## 广义吸烟者问题

Parnas 指出，如果我们修改代理，去掉"代理放出原料后要等待"这一要求，吸烟者问题会变得更难。在这种情况下，桌上可能有同一种原料的多份实例。

**问题**：修改前面的解法以处理这种变化。

::: details 提示：广义吸烟者问题
如果代理不等吸烟者，原料就可能在桌上堆积。我们不能再只用布尔值记录原料，而需要用整数来计数。

```python title="Generalized Smokers problem hint"
numTobacco = numPaper = numMatch = 0
```
:::

### 广义吸烟者问题解法 {#smoker}

下面是推手 A 修改后的代码：

```python title="Pusher A"
tobacco.wait()
mutex.wait()
    if numPaper:
        numPaper -= 1
        matchSem.signal()
    elif numMatch:
        numMatch -= 1
        paperSem.signal()
    else: 
        numTobacco += 1
mutex.signal()
```

想象这个问题的一种方式是：当一个代理运行时，它创建两个推手，给每个推手一种原料，并把它们和所有其他推手一起放进一个房间。由于互斥锁的存在，推手们排着队进入一个有三位沉睡的吸烟者和一张桌子的房间。每次一个推手进房间，检查桌上的原料。如果他能凑齐一整套原料，就把它们从桌上拿走并唤醒相应的吸烟者；如果凑不齐，他就把自己的原料留在桌上，不唤醒任何人就离开。

这是我们后面还会多次见到的一种模式，我称之为**记分牌**（scoreboard）。变量 `numPaper`、`numTobacco` 和 `numMatch` 记录系统的状态。每个线程依次通过互斥锁时，就像看记分牌一样检查状态，并做出相应反应。
