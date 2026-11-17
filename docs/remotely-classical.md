---
title: "远非经典的问题"
---

# 远非经典的问题

<div class="chap-en">Not Remotely Classical Problems</div>

这个问题的灵感来自 Kenneth Reek 提出的一个问题 [@reek]。想象一家有 5 个座位的寿司店。如果你到的时候还有空位，你可以马上坐下。但如果你到的时候 5 个座位全满了，那就意味着这 5 个人是一起来的，你得等整拨人离开之后才能坐下。

**问题**：为进入和离开寿司店的顾客编写代码，以满足这些要求。

::: details 提示：寿司店
下面是我用到的变量：

```python title="Sushi bar hint"
eating = waiting = 0
mutex = Semaphore(1)
block = Semaphore(0)
must_wait = False
```

`eating` 和 `waiting` 记录正坐在店里和正在等待的线程数。`mutex` 保护这两个计数器。`must_wait` 表示店里（已经）满了，所以新来的顾客必须在 `block` 上阻塞。
:::

### Sushi bar non-solution

下面是 Reek 用来说明这个问题难点之一的一个错误解法。

```python title="Sushi bar non-solution"
mutex.wait()
if must_wait:
    waiting += 1
    mutex.signal()
    block.wait()

    mutex.wait()      # reacquire mutex (*\label{sushi1}*)
    waiting -= 1

eating += 1
must_wait = (eating == 5)
mutex.signal()

# eat sushi

mutex.wait()
eating -= 1
if eating == 0:
    n = min(5, waiting)
    block.signal(n)
    must_wait = False
mutex.signal()
```

**问题**：这个解法有什么问题？

### Sushi bar non-solution

问题出在标有 sushi1 的那一行。如果一位顾客在店里满员时到达，他必须在等待期间交出互斥锁，这样其他顾客才能离开。当最后一位顾客离开时，她对 `block` 发信号，唤醒至少一部分等待中的顾客，并清除 `must_wait`。

但当这些顾客醒来时，它们必须重新拿回互斥锁，这意味着它们要和刚进来的新线程竞争。如果新线程先拿到互斥锁，它们可能在等待的线程之前把座位全占满。这不仅仅是公不公平的问题；有可能同时有超过 5 个线程处在临界区中，这就违反了同步约束。

Reek 给出了这个问题的两个解法，分别出现在接下来两节中。

**问题**：看看你能不能想出两个不同的正确解法！

提示：两个解法都没有使用任何额外的变量。

### Sushi bar solution #1

等待中的顾客之所以必须重新获取互斥锁，唯一的原因是要更新 `eating` 和 `waiting` 的状态，所以解决这个问题的一种办法是：让已经持有互斥锁的离开者替它们完成更新。

```python title="Sushi bar solution \\#1"
mutex.wait()
if must_wait:
    waiting += 1
    mutex.signal()
    block.wait()
else:
    eating += 1
    must_wait = (eating == 5)
    mutex.signal()

# eat sushi

mutex.wait()
eating -= 1
if eating == 0:
    n = min(5, waiting)
    waiting -= n
    eating += n
    must_wait = (eating == 5)
    block.signal(n)
mutex.signal()
```

当最后一位离开的顾客释放互斥锁时，`eating` 已经被更新过了，所以新来的顾客看到的是正确的状态，必要时就会阻塞。Reek 把这种模式称为"我替你办"，因为离开的线程做了逻辑上本应属于等待线程的工作。

这种做法的一个缺点是：要确认状态被正确更新稍微困难一些。

### Sushi bar solution #2

Reek 的另一个解法基于一个反直觉的想法：我们可以把互斥锁从一个线程转交给另一个线程！换句话说，一个线程可以获取锁，然后由另一个线程来释放它。只要两个线程都明白锁已经转手，这就没有任何问题。

```python title="Sushi bar solution \\#2"
mutex.wait()
if must_wait:
    waiting += 1
    mutex.signal()
    block.wait()     # when we resume, we have the mutex
    waiting -= 1

eating += 1
must_wait = (eating == 5)
if waiting and not must_wait:
    block.signal()            # and pass the mutex
else:
    mutex.signal()

# eat sushi

mutex.wait()
eating -= 1
if eating == 0: must_wait = False

if waiting and not must_wait:
    block.signal()            # and pass the mutex
else:
    mutex.signal()
```

如果店里顾客少于 5 位，而且没有人在等待，进店的顾客只需把 `eating` 加一然后释放互斥锁。第 5 位顾客会置上 `must_wait`。

如果 `must_wait` 被置上，进店的顾客就会阻塞，直到店里最后一位顾客清除 `must_wait` 并对 `block` 发信号。这里的约定是：发信号的线程交出互斥锁，等待的线程接收它。不过要记住，这只是程序员之间的约定，写在注释里，信号量的语义并不保证它。能不能做对，全靠我们自己。

当等待的线程被唤醒时，我们约定它已经持有互斥锁。如果还有其他线程在等待，它就再对 `block` 发信号，把互斥锁传给下一个等待的线程。这个过程持续下去，每个线程把互斥锁传给下一个，直到没有空椅子或者没有等待的线程为止。无论哪种情况，最后一个线程释放互斥锁，然后坐下。

Reek 把这种模式称为"传递接力棒"，因为互斥锁像接力赛中的接力棒一样从一个线程传到下一个线程。这个解法的一个好处是：很容易确认对 `eating` 和 `waiting` 的更新是一致的。缺点则是：要确认互斥锁被正确使用更困难一些。

## The child care problem

Max Hailperin 为他的教材 *Operating Systems and Middleware* 写了这个问题 [@hailperin]。在托儿所里，州里的规定要求每三个孩子必须始终有一位成人在场。

**问题**：为儿童线程和成人线程编写代码，在临界区中满足这一约束。

::: details 提示：托儿所
Hailperin 提示说，你*几乎*可以用一个信号量解决这个问题。

```python title="Child care hint"
multiplex = Semaphore(0)
```

`multiplex` 记录可用令牌的数量，每个令牌允许一个儿童线程进入。成人进入时对 `multiplex` 发三次信号；离开时 `wait` 三次。但这个解法有一个问题。

**问题**：问题是什么？
:::

### Child care non-solution

下面是 Hailperin 的错误解法中成人的代码：

```python title="Child care non-solution (adult)"
multiplex.signal(3)

# critical section

multiplex.wait()
multiplex.wait()
multiplex.wait()
```

问题在于可能发生死锁。想象托儿所里有三个孩子和两位成人。`multiplex` 的值是 3，所以两位成人中的任何一位都应该能离开。但如果两位成人同时开始离开，它们可能把可用令牌分掉，结果两个都阻塞。

**问题**：用最小的改动解决这个问题。

::: details 解答：托儿所
加一个互斥锁就能解决：

```python title="Child care solution (adult)"
multiplex.signal(3)

# critical section

mutex.wait()
    multiplex.wait()
    multiplex.wait()
    multiplex.wait()
mutex.signal()
```

现在三个 `wait` 操作是原子的。如果有三个可用令牌，拿到互斥锁的线程会拿到全部三个令牌并退出。如果可用令牌不足三个，第一个线程会在互斥锁上阻塞，后续线程则在互斥锁上排队。
:::

### Extended child care problem

这个解法的一个特点是：一位等待离开的成人线程可能会阻止儿童线程进入。

想象有 4 个孩子和两位成人，所以 multiplex 的值是 2。如果其中一位成人试图离开，她会拿走两个令牌，然后阻塞等待第三个。如果这时来了一个儿童线程，它即使合法也无法进入，只能等待。从那位想离开的成人的角度看，这也许没什么不好，但如果你想最大化托儿所的利用率，这就不理想了。

**问题**：写一个避免不必要等待的解法。

提示：想想 dancers 一节里的舞者。

::: details 提示：扩展托儿所
下面是我解法中用到的变量：

```python title="Extended child care hint"
children = adults = waiting = leaving = 0
mutex = Semaphore(1)
childQueue = Semaphore(0)
adultQueue = Semaphore(0)
```

`children`、`adults`、`waiting` 和 `leaving` 分别记录孩子数、成人数、等待进入的孩子数和等待离开的成人数；它们由 `mutex` 保护。

孩子需要时在 `childQueue` 上等待进入。成人在 `adultQueue` 上等待离开。
:::

::: details 解答：扩展托儿所
这个解法比 Hailperin 那个优雅的解法复杂，但它主要是我们已经见过的几种模式的组合：记分牌、两个队列，以及"我替你办"。

儿童代码如下：

```python title="Extended child care solution (child)"
mutex.wait()
    if children < 3 * adults:
        children++
        mutex.signal()
    else:
        waiting++
        mutex.signal()
        childQueue.wait()

# critical section

mutex.wait()
    children--
    if leaving and children <= 3 * (adults-1):
        leaving--
        adults--
        adultQueue.signal() 
mutex.signal()
```

孩子进入时检查成人是否够数，然后要么（1）把 `children` 加一并进入，要么（2）把 `waiting` 加一并阻塞。离开时，它们检查是否有正在等待离开的成人线程，如果可能就对其发信号。

下面是成人的代码：

```python title="Extended child care solution (adult)"
mutex.wait()
    adults++
    if waiting:
        n = min(3, waiting)
        childQueue.signal(n)
        waiting -= n
        children += n
mutex.signal()

# critical section

mutex.wait()
    if children <= 3 * (adults-1):
        adults--
        mutex.signal()
    else:
        leaving++
        mutex.signal()
        adultQueue.wait() 
```

成人进入时，如果有等待的孩子就对其发信号。离开之前，它们检查剩下的成人是否够数。如果够，就把 `adults` 减一并退出。否则把 `leaving` 加一并阻塞。当一个成人线程在等待离开时，它仍然算作临界区中的一位成人，所以可以有更多孩子进入。
:::

## The room party problem

这个问题是我在科尔比学院（Colby College）时写的。有一个学期，一位学生指控学生事务长办公室有人趁他不在时搜查了他的房间，这事引起了争议。虽然这项指控是公开的，但学生事务长无法就此案发表评论，所以我们始终不知道真相如何。我写这个问题是为了打趣我的一位朋友，他当时是学生住宿事务长。

以下同步约束适用于学生和学生事务长（Dean of Students）：

1.  任意数量的学生可以同时待在一个房间里。

2.  学生事务长只有在房间里没有学生时（为了搜查）或者房间里的学生超过 50 人时（为了驱散派对）才能进入房间。

3.  学生事务长在房间里时，不允许其他学生进入，但学生可以离开。

4.  在所有学生离开之前，学生事务长不得离开房间。

5.  只有一个学生事务长，所以你不必在多个事务长之间实现互斥。

**问题**：为学生和学生事务长编写同步代码，满足以上所有约束。

::: details 提示：宿舍派对
```python title="Room party hint"
students = 0                
dean = 'not here'           
mutex = Semaphore(1)
turn = Semaphore(1)
clear = Semaphore(0)
lieIn = Semaphore(0)
```

`students` 记录房间里的学生数，`dean` 是事务长的状态，也可以是 "waiting" 或 "in the room"。`mutex` 保护 `students` 和 `dean`，所以这又是一个记分牌的例子。

`turn` 是一个旋转门，在事务长待在房间里时阻止学生进入。

`clear` 和 `lieIn` 用作学生与事务长之间的会合（这又是另一桩丑闻！）。
:::

::: details 解答：宿舍派对
这个问题很难。我试了很多版本才得到这一个。第一版里出现的那个版本基本正确，但偶尔事务长会进入房间，然后发现自己既不能搜查也不能驱散派对，只好尴尬地悄悄溜走。

Matt Tesch 写了一个不会陷入这种窘境的解法，但结果相当复杂，我们很难说服自己它是正确的。不过那个解法引导我得到了下面这个，它可读性更好一些。

```python title="Room party solution (dean)"
mutex.wait()
    if students > 0 and students < 50:
        dean = 'waiting'
    mutex.signal()
    lieIn.wait()     # and get mutex from the student.

    # students must be 0 or >= 50     (*\label{roomparty1}*)

    if students >= 50:
        dean = 'in the room'
        breakup()
    turn.wait()      # lock the turnstile
        mutex.signal()
    clear.wait()     # and get mutex from the student.
    turn.signal()    # unlock the turnstile

    else:                # students must be 0
        search()

dean = 'not here'
mutex.signal() 
```

事务长到达时有三种情况：如果房间里有学生，但不到 50 人，事务长必须等待。如果有 50 人或更多，事务长驱散派对并等待学生离开。如果没有学生，事务长搜查后离开。

在前两种情况下，事务长必须等与学生会合，所以他必须交出 `mutex` 以避免死锁。当事务长被唤醒时，他要修改记分牌，所以需要重新拿回互斥锁。这和我们在寿司店问题中看到的情形类似。我选择的解法是"传递接力棒"模式。

```python title="Room party solution (student)"
mutex.wait()
    if dean == 'in the room':
        mutex.signal()
        turn.wait()
        turn.signal()
        mutex.wait()

    students += 1

    if students == 50 and dean == 'waiting':
        lieIn.signal()             # and pass mutex to the dean
    else:
        mutex.signal()

party()

mutex.wait()
    students -= 1

    if students == 0 and dean == 'waiting':
        lieIn.signal()         # and pass mutex to the dean
    elif students == 0 and dean == 'in the room':
        clear.signal()         # and pass mutex to the dean
    else:
        mutex.signal()
```

有三种情况学生可能需要通知事务长。如果事务长正在等待，那么第 50 个进入的学生或最后一个离开的学生必须对 `lieIn` 发信号。如果事务长在房间里（等待所有学生离开），最后一个离开的学生对 `clear` 发信号。这三种情况下，都约定互斥锁从学生转交给事务长。

这个解法中有一点可能不太明显：我们怎么知道在事务长代码中标有 roomparty1 的那一行，`students` 一定是 0 或者不小于 50？关键在于认识到只有两条路径能到达这里：要么第一个条件判断为假，这意味着 `students` 是 0 或者不小于 50；要么事务长当时正在 `lieIn` 上等待，而某个学生发了信号，这同样意味着 `students` 是 0 或者不小于 50。
:::

## The Senate Bus problem

这个问题最初基于韦尔斯利学院（Wellesley College）的参议院班车。乘客来到车站等车。班车到达时，所有等待的乘客调用 `boardBus`，但在班车正在上客时到达的人必须等下一班。班车的容量是 50 人；如果等待的人超过 50 个，有些人就得等下一班。

当所有等待的乘客都上车后，班车可以调用 `depart`。如果班车到达时没有乘客，它应当立即发车。

**问题**：编写同步代码，满足以上所有约束。

::: details 提示：班车问题
下面是我解法中用到的变量：

```python title="Bus problem hint"
riders = 0
mutex = Semaphore(1)
multiplex = Semaphore(50)
bus = Semaphore(0)
allAboard = Semaphore(0)
```

`mutex` 保护 `riders`，它记录有多少乘客在等待；`multiplex` 确保上客区不超过 50 位乘客。

乘客在 `bus` 上等待，班车到达时对 `bus` 发信号。班车在 `allAboard` 上等待，最后一个上车的乘客对它发信号。
:::

### Bus problem solution #1

下面是班车的代码。这里我们又一次使用了"传递接力棒"模式。

```python title="Bus problem solution (bus)"
mutex.wait()
if riders > 0:
    bus.signal()        # and pass the mutex
    allAboard.wait()    # and get the mutex back
mutex.signal()

depart()
```

班车到达时，它拿到 `mutex`，这可以阻止迟到的乘客进入上客区。如果没有乘客，它立即发车。否则，它对 `bus` 发信号并等待乘客上车。

下面是乘客的代码：

```python title="Bus problem solution (riders)"
multiplex.wait()
    mutex.wait()
        riders += 1
    mutex.signal()

    bus.wait()              # and get the mutex
multiplex.signal()

boardBus()

riders -= 1
if riders == 0:
    allAboard.signal() 
else:
    bus.signal()            # and pass the mutex
```

`multiplex` 控制等待区中的乘客数量，不过严格来说，乘客要等到把 `riders` 加一之后才算进入等待区。

乘客在 `bus` 上等待班车到达。当一个乘客被唤醒时，约定它已经持有互斥锁。上车之后，每个乘客把 `riders` 减一。如果还有乘客在等待，刚上车的乘客就对 `bus` 发信号，把互斥锁传给下一个乘客。最后一个乘客对 `allAboard` 发信号，把互斥锁交还给班车。

最后，班车释放互斥锁并发车。

**问题**：你能用"我替你办"模式给出这个问题的另一个解法吗？

### Bus problem solution #2

Grant Hutchins 想出了这个解法，它用的变量比上一个少，而且不涉及互斥锁的传递。变量如下：

```python title="Bus problem solution \\#2 (initialization)"
waiting = 0
mutex = Semaphore(1)
bus = Semaphore(0)
boarded = Semaphore(0)
```

`waiting` 是上客区里的乘客数，由 `mutex` 保护。`bus` 在班车到达时发信号；`boarded` 表示某个乘客已经上车。

下面是班车的代码。

```python title="Bus problem solution (bus)"
mutex.wait()
n = min(waiting, 50)
for i in range(n):
    bus.signal()
    boarded.wait()

waiting = max(waiting-50, 0)
mutex.signal()

depart()
```

班车拿到 `mutex` 并在整个上客过程中一直持有它。循环依次对每个乘客发信号，并等待其上车。通过控制信号的数量，班车保证上车人数不超过 50。

当所有乘客都上车后，班车更新 `waiting`，这是"我替你办"模式的一个例子。

乘客的代码用了两个简单的模式：一个互斥锁和一次会合。

```python title="Bus problem solution (riders)"
mutex.wait()
     waiting += 1
mutex.signal()

bus.wait()
board()
boarded.signal()
```

挑战：如果乘客在班车上客期间到达，你让他们等下一班可能会让他们不快。你能找到一个解法，让迟到的乘客也能上车，同时不违反其他约束吗？

## The Faneuil Hall problem

这个问题由 Grant Hutchins 编写，他的灵感来自一位朋友，她在波士顿的法尼尔厅参加了入籍宣誓。

"线程共有三种：移民、旁观者和一位法官。移民必须排队、签到，然后坐下。某个时刻，法官进入大楼。法官在大楼里时，任何人不得进入，移民也不得离开。旁观者可以离开。等所有移民都签到之后，法官可以确认入籍。确认之后，移民领取美国公民证书。法官在确认之后的某个时刻离开。旁观者此时可以像之前一样进入。移民拿到证书之后可以离开。"

为了让这些要求更具体，我们给这些线程一些要执行的函数，并对这些函数施加约束。

-   移民必须调用 `enter`、`checkIn`、`sitDown`、`swear`、`getCertificate` 和 `leave`。

-   法官调用 `enter`、`confirm` 和 `leave`。

-   旁观者调用 `enter`、`spectate` 和 `leave`。

-   法官在大楼里时，任何人不得 `enter`，移民也不得 `leave`。

-   在所有已经调用 `enter` 的移民也都调用了 `checkIn` 之前，法官不能 `confirm`。

-   在法官执行 `confirm` 之前，移民不能 `getCertificate`。

::: details 提示：法尼尔厅问题
```python title="Faneuil Hall problem hint"
noJudge = Semaphore(1)
entered = 0
checked = 0
mutex = Semaphore(1)
confirmed = Semaphore(0)
```

`noJudge` 充当进入的移民和旁观者的旋转门；它还保护 `entered`，后者记录房间里的移民人数。`checked` 记录已签到的移民人数；它由 `mutex` 保护。

`confirmed` 表示法官已经执行了 `confirm`。
:::

::: details 解答：法尼尔厅问题
下面是移民的代码：

```python title="Faneuil Hall problem solution (immigrant)"
noJudge.wait()
enter()
entered++
noJudge.signal()

mutex.wait()
checkIn()
checked++

if judge == 1 and entered == checked:
    allSignedIn.signal()              # and pass the mutex
else:
    mutex.signal()

sitDown()
confirmed.wait()

swear()
getCertificate()

noJudge.wait()
leave()
noJudge.signal()
```

移民进入时通过一个旋转门；法官在房间里时，这个旋转门是锁住的。

进入之后，移民必须拿到 `mutex` 才能签到并更新 `checked`。如果有法官在等待，最后一个签到的移民对 `allSignedIn` 发信号，并把互斥锁交给法官。

下面是法官的代码：

```python title="Faneuil Hall problem solution (judge)"
noJudge.wait()
mutex.wait()

enter()
judge = 1

if entered > checked:
    mutex.signal()
    allSignedIn.wait()               # and get the mutex back.

confirm()
confirmed.signal(checked)
entered = checked = 0

leave()
judge = 0

mutex.signal()
noJudge.signal()
```

法官持有 `noJudge` 以阻止移民和旁观者进入，并持有 `mutex` 以便访问 `entered` 和 `checked`。

如果法官到达的那一刻，所有已经进入的移民也都已经签到，她就可以立即继续。否则，她必须交出互斥锁并等待。当最后一个移民签到并对 `allSignedIn` 发信号时，约定法官会重新拿回互斥锁。

调用 `confirm` 之后，法官为每一位已签到的移民对 `confirmed` 发一次信号，然后重置计数器（这是"我替你办"的一个例子）。然后法官离开，释放 `mutex` 和 `noJudge`。

法官对 `confirmed` 发信号之后，移民并发地调用 `swear` 和 `getCertificate`，然后等待 `noJudge` 旋转门打开再离开。

旁观者的代码很简单；它们唯一要遵守的约束就是 `noJudge` 旋转门。

```python title="Faneuil Hall problem solution (spectator)"
noJudge.wait()
enter()
noJudge.signal()

spectate()

leave()
```

注意：在这个解法中，移民拿到证书后，如果又有一位法官来为下一批移民主持宣誓，他们可能会被困住。如果发生这种情况，他们可能得再等一场宣誓仪式结束。

**问题**：修改这个解法，以处理额外的约束：法官离开后，所有已宣誓的移民必须先全部离开，法官才能再次进入。
:::

::: details 提示：扩展法尼尔厅问题
我的解法用了以下额外变量：

```python title="Faneuil Hall problem hint"
exit = Semaphore(0)
allGone = Semaphore(0)
```

既然扩展问题多了一次会合，我们可以用两个信号量来解决它。

另一个提示：我发现再次使用"传递接力棒"模式很有用。
:::

::: details 解答：扩展法尼尔厅问题
这个解法的上半部分和之前一样。差别从标有 fanexit 的那一行开始。移民在这里等待法官离开。

```python title="Faneuil Hall problem solution (immigrant)"
noJudge.wait()
enter()
entered++
noJudge.signal()

mutex.wait()
checkIn()
checked++

if judge = 1 and entered == checked:
    allSignedIn.signal()              # and pass the mutex
else:
    mutex.signal()

sitDown()
confirmed.wait()

swear()
getCertificate()

exit.wait()                          # and get the mutex(*\label{fanexit}*)
leave()
checked--
if checked == 0:
    allGone.signal()                 # and pass the mutex
else:
    exit.signal()                    # and pass the mutex
```

对法官来说，差别从标有 fanjudge 的那一行开始。当法官准备离开时，她不能释放 `noJudge`，因为那会允许更多移民、甚至另一位法官进入。于是她对 `exit` 发信号，这允许一位移民离开，并交出 `mutex`。

拿到信号的移民把 `checked` 减一，然后把接力棒传给下一位移民。最后一个离开的移民对 `allGone` 发信号，把互斥锁交还给法官。这次交还并非严格必要，但它的好处是让法官同时释放 `mutex` 和 `noJudge`，干净地结束这个阶段。

```python title="Faneuil Hall problem solution (judge)"
noJudge.wait()
mutex.wait()

enter()
judge = 1

if entered > checked:
    mutex.signal()
    allSignedIn.wait()               # and get the mutex back.

confirm()
confirmed.signal(checked)
entered = 0

leave()
judge = 0

exit.signal()                       # and pass the mutex(*\label{fanjudge}*)
allGone.wait()                      # and get it back
mutex.signal()
noJudge.signal()
```

扩展问题中旁观者的代码不变。
:::

## Dining Hall problem

这个问题是 Jon Pollack 在我于欧林学院（Olin College）讲授同步课程时写的。

食堂里的学生调用 `dine`，然后调用 `leave`。在调用 `dine` 之后、调用 `leave` 之前，学生被视为"准备离开"。

适用于学生的同步约束是：为了维持社交上从容得体的假象，学生绝不能独自坐在一张桌子旁。如果在一位学生完成 `dine` 之前，所有其他调用过 `dine` 的学生都调用了 `leave`，那么这位学生就被视为独自坐着。

**问题**：编写代码满足这一约束。

::: details 提示：食堂问题
```python title="Dining Hall problem hint"
eating = 0
readyToLeave = 0
mutex = Semaphore(1)
okToLeave = Semaphore(0)
```

`eating` 和 `readyToLeave` 是由 `mutex` 保护的计数器，所以这是常见的记分牌模式。

如果一位学生准备离开，但另一位学生会因此独自留在桌旁，她就在 `okToLeave` 上等待，直到另一位学生改变局面并发出信号。
:::

::: details 解答：食堂问题
如果你分析这些约束，就会发现只有一种情况学生必须等待：一位学生在吃，另一位学生想走。但摆脱这种局面有两条路：可能又来了一个学生要吃，也可能正在吃的学生吃完了。

无论哪种情况，给等待学生发信号的那个学生都会更新计数器，所以等待的学生不必重新拿回互斥锁。这是"我替你办"模式的又一个例子。

```python title="Dining Hall problem solution"
getFood()

mutex.wait()
eating++
if eating == 2 and readyToLeave == 1:
    okToLeave.signal()
    readyToLeave--
mutex.signal()

dine()

mutex.wait()
eating--
readyToLeave++

if eating == 1 and readyToLeave == 1:
    mutex.signal()
    okToLeave.wait()
elif eating == 0 and readyToLeave == 2:
    okToLeave.signal()
    readyToLeave -= 2
    mutex.signal()
else:
    readyToLeave--
    mutex.signal()

leave()
```

当一位学生登记时，如果她看到一位学生在吃、一位在等待离开，她就替那位等待者解围，并替他递减 `readyToLeave`。

吃完之后，学生检查三种情况：

-   如果只剩一位学生在吃，要离开的学生必须交出互斥锁并等待。

-   如果要离开的学生发现有别人在等她，她就对他发信号，并替两个人更新计数器。

-   否则，她只需递减 `readyToLeave` 然后离开。
:::

## Extended Dining Hall problem

如果再加一步，食堂问题就会稍微难一些。学生来吃午饭时调用 `getFood`、`dine`，然后 `leave`。在调用 `getFood` 之后、调用 `dine` 之前，学生被视为"准备就餐"。同样，在调用 `dine` 之后，学生被视为"准备离开"。

同样的同步约束仍然适用：学生绝不能独自坐在一张桌子旁。以下任一情况下，学生被视为独自坐着：

-   她在桌旁没有别人、也没有人准备就餐时调用 `dine`；或者

-   在她完成 `dine` 之前，所有其他调用过 `dine` 的学生都调用了 `leave`。

**问题**：编写代码满足这些约束。

::: details 提示：扩展食堂问题
下面是我解法中用到的变量：

```python title="Extended Dining Hall problem hint"
readyToEat = 0
eating = 0
readyToLeave = 0
mutex = Semaphore(1)
okToSit = Semaphore(0)
okToLeave = Semaphore(0)
```

`readyToEat`、`eating` 和 `readyToLeave` 都是计数器，全部由 `mutex` 保护。

如果一位学生处于无法继续的局面，她就在 `okToSit` 或 `okToLeave` 上等待，直到另一位学生改变局面并发出信号。

我还用了一个名为 `hasMutex` 的每线程变量，用来帮助记录一个线程是否持有互斥锁。
:::

::: details 解答：扩展食堂问题
同样，分析这些约束后我们会发现，只有一种情况准备就餐的学生必须等待：没有人在吃，也没有别人准备就餐。而唯一的出路是又来了一位准备就餐的学生。

```python title="Extended Dining Hall problem solution"
getFood()

mutex.wait()
readyToEat++
if eating == 0 and readyToEat == 1:
    mutex.signal()
    okToSit.wait()
elif eating == 0 and readyToEat == 2:
    okToSit.signal()
    readyToEat -= 2
    eating += 2
    mutex.signal()
else:
    readyToEat--
    eating++
    if eating == 2 and readyToLeave == 1:
        okToLeave.signal()
        readyToLeave--
    mutex.signal()

dine()

mutex.wait()
eating--
readyToLeave++
if eating == 1 and readyToLeave == 1:
    mutex.signal()
    okToLeave.wait()
elif eating == 0 and readyToLeave == 2:
    okToLeave.signal()
    readyToLeave -= 2
    mutex.signal()
else:
    readyToLeave--
    mutex.signal()

leave()
```

和上一个解法一样，我使用了"我替你办"模式，这样等待的学生就不必重新拿回互斥锁。

这个解法和上一个解法的主要区别在于：第一个到达空桌的学生必须等待，而第二个学生让两人都能继续。无论哪种情况，我们都不必检查是否有学生在等待离开，因为没人能离开一张空桌！
:::
