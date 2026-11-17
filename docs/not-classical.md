---
title: "非经典问题"
---

# 非经典问题

<div class="chap-en">Not-so-classical Problems</div>

<div class="chap-en">Not-so-classical Problems</div>

这道题出自 Andrews 的《并发编程》（*Concurrent Programming*）。

> 三类线程共享对同一个单链表的访问：搜索者、插入者和删除者。搜索者只是查看链表，因此它们彼此之间可以并发执行。插入者把新项加到链表末尾；插入操作必须互斥，以免两个插入者几乎同时插入新项。不过，一次插入可以与任意多次搜索并行进行。最后，删除者从链表中的任意位置移除项。同一时刻至多只能有一个删除者进程访问链表，而且删除也必须与搜索和插入互斥。

**问题**：为搜索者、插入者和删除者编写代码，实现这种三路分类互斥。

::: details 提示：搜索-插入-删除
```python title="Search-Insert-Delete hint"
insertMutex = Semaphore(1)
noSearcher = Semaphore(1)
noInserter = Semaphore(1)
searchSwitch = Lightswitch()
insertSwitch = Lightswitch()
```

`insertMutex` 保证同一时刻只有一个插入者处于临界区。`noSearcher` 和 `noInserter` 表示（不出所料）当前没有搜索者、也没有插入者处于临界区；删除者必须同时持有这两个信号量才能进入。

搜索者和插入者用 `searchSwitch` 和 `insertSwitch` 来排斥删除者。
:::

::: details 解答：搜索-插入-删除
下面是我的解法：

```python title="Search-Insert-Delete solution (searcher)"
searchSwitch.wait(noSearcher)
# critical section
searchSwitch.signal(noSearcher)
```

搜索者唯一需要提防的就是删除者。第一个进入的搜索者拿走 `noSearcher`，最后一个离开的释放它。

```python title="Search-Insert-Delete solution (inserter)"
insertSwitch.wait(noInserter)
insertMutex.wait()
# critical section
insertMutex.signal()
insertSwitch.signal(noInserter)
```

类似地，第一个插入者拿走 `noInserter`，最后一个离开的释放它。由于搜索者和插入者争用的是不同的信号量，它们可以同时处于各自的临界区。但 `insertMutex` 保证同一时刻只有一个插入者“在房间里”。

```python title="Search-Insert-Delete solution (deleter)"
noSearcher.wait()
noInserter.wait()
# critical section
noInserter.signal()
noSearcher.signal()
```

由于删除者同时持有 `noSearcher` 和 `noInserter`，它就能获得独占访问。当然，只要看到某个线程持有不止一个信号量，我们就得检查死锁。试想几种情形，你应该就能说服自己这个解法不会死锁。

另一方面，和许多分类互斥问题一样，这个问题容易出现饥饿。正如我们在读者-写者问题中看到的，有时可以按具体应用的标准给某一类线程优先权，以此缓解这个问题。但一般来说，要写出既高效（允许最大并发度）又避免饥饿的解法是很难的。
:::

## 男女共用洗手间问题

我写这道题[^1]的时候，我的一位朋友刚辞去科尔比学院（Colby College）的物理教职，去了施乐（Xerox）工作。

她在一栋混凝土大楼地下室的隔间里办公，最近的洗手间在楼上两层。她向大老板提议，把她那层的男洗手间改成男女共用，有点像《甜心俏佳人》（Ally McBeal）里的那种。

大老板同意了，前提是能满足下面这些同步约束：

-   洗手间里不能同时有男有女。

-   任何时候都不该有超过三名员工在洗手间里浪费公司的时间。

当然，解法要避免死锁。不过眼下先不用担心饥饿。你可以假定洗手间里配备了你需要的所有信号量。

::: details 提示：男女共用洗手间
下面是我在解法里用到的变量：

```python title="Unisex bathroom hint"
empty = Semaphore(1)
maleSwitch = Lightswitch()
femaleSwitch = Lightswitch()
maleMultiplex = Semaphore(3)
femaleMultiplex = Semaphore(3)
```

如果房间是空的，`empty` 为 1，否则为 0。

`maleSwitch` 让男人能把女人挡在门外。第一个男人进入时，这个电灯开关锁住 `empty`，把女人挡在外面；最后一个男人离开时，它解锁 `empty`，允许女人进入。女人则用 `femaleSwitch` 做同样的事。

`maleMultiplex` 和 `femaleMultiplex` 保证同一时刻系统里最多只有三个男人和三个女人。
:::

::: details 解答：男女共用洗手间
下面是女人的代码：

```python title="Unisex bathroom solution (female)"
femaleSwitch.lock(empty)
    femaleMultiplex.wait()
        # bathroom code here
    femaleMultiplex.signal()
female Switch.unlock(empty)
```

男人的代码与之类似。

这个解法有什么问题吗？
:::

## 无饥饿的男女共用洗手间问题

上一个解法的问题在于它允许饥饿。一长队女人可以接连不断地到来并进入，而一个男人一直在等着，反过来也一样。

**问题**：解决这个问题。

::: details 解答：无饥饿的男女共用洗手间
正如我们之前所见，可以用旋转门让一类线程挡住另一类线程的通行。这次我们来看男人的代码：

```python title="No-starve unisex bathroom solution (male)"
turnstile.wait()
    maleSwitch.lock(empty)
turnstile.signal()

    maleMultiplex.wait()
        # bathroom code here
    maleMultiplex.signal()

maleSwitch.unlock (empty)
```

只要房间里有男人，新来的人就会穿过旋转门进去。如果一个男人到来时房间里有女人，他就会堵在旋转门里，从而拦住之后所有（男性和女性）来者，直到当前里面的人离开为止。到那时，旋转门里的这个男人进入，可能还会让更多男人跟着进入。

女人的代码与之类似，所以如果房间里有男人，到来的女人就会卡在旋转门里，挡住其他男人。

这个解法可能并不高效。如果系统很忙，旋转门上往往排着好几个男男女女的线程。每次 `empty` 被发信号，就有一个线程离开旋转门、另一个线程进入。如果新进来的线程是异性，它马上就会阻塞，把后面的线程挡住。因此，洗手间里通常只有 1 到 2 个线程，系统无法充分利用可用的并发度。
:::

## 狒狒过河问题

这道题改编自 Tanenbaum 的《操作系统：设计与实现》（*Operating Systems: Design and Implementation*）。南非克鲁格国家公园（Kruger National Park）的某处有一道深谷，一根绳子横跨峡谷。狒狒可以双手交替攀着绳子荡过峡谷，但如果两只方向相反的狒狒在中间相遇，它们就会打起来，双双坠落而死。此外，绳子的强度只够承受 5 只狒狒；同一时刻绳子上的狒狒再多，它就会断。

假定我们能教会狒狒使用信号量，我们想设计一套具备以下性质的同步方案：

-   一只狒狒一旦开始过河，就保证能到达对岸，而不会撞上迎面而来的狒狒。

-   绳子上永远不会超过 5 只狒狒。

-   持续不断朝一个方向过河的狒狒，不应无限期地挡住反方向的狒狒（无饥饿）。

出于显而易见的理由，我不打算给出这道题的解答。

## Modus Hall 问题

这道题是 Nathan Karst 写的，他是 2005 年冬天住在 Modus Hall 的欧林（Olin）学生之一[^2]。

> 今年冬天一场特大的雪之后，Modus Hall 的居民在他们用纸板搭成的棚户区与校园其他地方之间，开出了一条沟槽似的小路。每天都有一些居民经由这条小路往返于课堂、食物和文明世界之间；那些每天宁可开车去 Tier 3 的懒散学生，我们不予理会。我们也不考虑行人行走的方向。出于某种不明的原因，住在 West Hall 的学生偶尔会觉得有必要冒险去一趟 Mods。
>
> 可惜小路不够宽，容不下两个人并排走。如果两个 Mods 的人在小路上某处相遇，其中一个会欣然让到一边，踩进齐颈深的雪堆里给对方让路。两个 ResHall 居民相遇时也是类似的情形。但要是 Mods 的“异教徒”和 ResHall 的“正经人”碰上了，就会爆发一场激烈的冲突，胜负完全取决于人数多寡；也就是说，人多的一派会强迫另一派等着。

这跟狒狒过河问题很像（而且不止一个方面像），只是多了一点变化：临界区的控制权由多数决定。这有可能成为分类互斥问题的一个既高效又无饥饿的解法。

之所以能避免饥饿，是因为在一派控制临界区的时候，另一派的成员会排起队来，直到人数占多数。这时他们就能拦住新的对手，不让其进入，同时等待临界区清空。我预期这个解法是高效的，因为它倾向于成批地放行线程，让临界区里的并发度达到最大。

**问题**：编写代码，实现按多数决定的分类互斥。

::: details 提示：Modus Hall 问题
下面是我在解法里用到的变量。

```python title="Modus problem hint"
heathens = 0
prudes = 0
status = 'neutral'
mutex = Semaphore(1)
heathenTurn = Semaphore(1)
prudeTurn = Semaphore(1)
heathenQueue = Semaphore(0)
prudeQueue = Semaphore(0)
```

`heathens` 和 `prudes` 是计数器，`status` 记录场地的状态，可以是 'neutral'、'heathens rule'、'prudes rule'、'transition to heathens' 或 'transition to prudes'。这三个变量都由 `mutex` 以常见的记分板模式保护。

`heathenTurn` 和 `prudeTurn` 控制对场地的访问，这样在过渡期间我们就能拦住其中一方。

`heathenQueue` 和 `prudeQueue` 是线程签到之后、上场之前等待的地方。
:::

::: details 解答：Modus Hall 问题
下面是异教徒的代码：

```python title="Modus problem solution"
heathenTurn.wait()
heathenTurn.signal()
(*\label{silentmajority}*)
mutex.wait()
heathens++

if status == 'neutral':
    status = 'heathens rule'
    mutex.signal()
elif status == 'prudes rule':
    if heathens > prudes:
        status = 'transition to heathens'
        prudeTurn.wait()
    mutex.signal()
    heathenQueue.wait()
elif status == 'transition to heathens':
    mutex.signal()
    heathenQueue.wait()
else
    mutex.signal()

# cross the field

mutex.wait()
heathens--

if heathens == 0:
    if status == 'transition to prudes':
        prudeTurn.signal()
    if prudes:
        prudeQueue.signal(prudes)
        status = 'prudes rule'
    else:
        status = 'neutral'
        
if status == 'heathens rule':
    if prudes > heathens:
        status = 'transition to prudes'
        heathenTurn.wait()

mutex.signal()
```

每个学生签到时，都要考虑以下几种情况：

-   如果场地是空的，这个学生就替异教徒一方占下场地。

-   如果现在是异教徒掌权，但新来者打破了力量对比，他就锁上正经人那边的旋转门，系统切换到过渡模式。

-   如果现在是正经人掌权，而新来者没有打破力量对比，他就去排队。

-   如果系统正在过渡到异教徒掌权，新来者就去排队。

-   否则，我们就认定要么是异教徒掌权，要么系统正在过渡到正经人掌权。无论哪种情况，这个线程都可以继续。

同样，每个学生签退时，也要考虑几种情况。

-   如果她是最后一个签退的异教徒，她得考虑下面这些：

    -   如果系统正处于过渡中，说明正经人的旋转门是锁着的，她得把它打开。

    -   如果有正经人在等，她就给他们发信号，并更新 `status`，让正经人掌权。如果没有，新状态就是 'neutral'。

-   如果她不是最后一个签退的异教徒，她仍要检查自己离开后是否可能打破力量对比。如果是，她就关上异教徒这边的旋转门，开始过渡。

这个解法的一个潜在麻烦是：任意数量的线程都可能在标注为 `silentmajority` 的那一行被中断，此时它们已经通过了旋转门，但还没有签到。在它们签到之前，它们不被计数，所以力量对比可能并不反映已经通过旋转门的线程数。另外，过渡是在所有已签到的线程也都签退之后才结束的。到那时，可能还有（两种类型的）线程已经通过了旋转门。

这些行为可能影响效率——这个解法并不保证最大并发度——但只要你接受“多数决定”只适用于已经登记投票的线程，它们就不影响正确性。
:::

[^1]: 后来我才知道，Andrews 的《并发编程》里有一个几乎一模一样的问题。
[^2]: Modus Hall 是“模块化建筑”（modular buildings，简称 Mods）的几个绰号之一；在第二栋宿舍楼修建期间，一些学生就住在那里。
