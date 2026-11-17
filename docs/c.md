---
title: "C 语言中的同步"
---

# C 语言中的同步

<div class="chap-en">Synchronization in C</div>

<div class="chap-en">Synchronization in C</div>

本节我们用 C 写一个多线程的同步程序。附录里给出了一些工具代码，我靠它们让 C 代码稍微好入口一点。本节的例子都依赖那些代码。

## 互斥

我们先定义一个包含共享变量的结构体：

```python
typedef struct {
  int counter;
  int end;
  int *array;
} Shared;

Shared *make_shared (int end)
{
  int i;
  Shared *shared = check_malloc (sizeof (Shared));

  shared->counter = 0;
  shared->end = end;

  shared->array = check_malloc (shared->end * sizeof(int));
  for (i=0; i<shared->end; i++) {
    shared->array[i] = 0;
  }
  return shared;
}
```

`counter` 是一个共享变量，多个并发线程会不断把它加一，直到它达到 `end`。我们会用 `array` 记录每次加一之后 `counter` 的取值，以此检查同步错误。

### 父线程代码

下面是父线程用来创建线程、并等待它们完成的代码：

```python
int main ()
{
  int i;
  pthread_t child[NUM_CHILDREN];

  Shared *shared = make_shared (100000);

  for (i=0; i<NUM_CHILDREN; i++) {
    child[i] = make_thread (entry, shared);
  }

  for (i=0; i<NUM_CHILDREN; i++) {
    join_thread (child[i]);
  }

  check_array (shared);
  return 0;
}
```

第一个循环创建子线程，第二个循环等待它们完成。当最后一个子线程结束后，父线程调用 `check_array` 检查错误。`make_thread` 和 `join_thread` 定义在附录里。

### 子线程代码

下面是每个子线程执行的代码：

```python
void child_code (Shared *shared)
{
  while (1) {
    if (shared->counter >= shared->end) {
      return;
    }
    shared->array[shared->counter]++;
    shared->counter++;
  }
}
```

每次循环，子线程都用 `counter` 作为下标访问 `array`，把对应的元素加一。然后它们把 `counter` 加一，并检查是否已经做完。

### 同步错误

如果一切正常，数组的每个元素都应该被加一一次。所以要检查错误，只要数一数有多少个元素不等于 1 就行了：

```python
void check_array (Shared *shared)
{
  int i, errors=0;

  for (i=0; i<shared->end; i++) {
    if (shared->array[i] != 1) errors++;
  }
  printf ("%d errors.\n", errors);
}
```

你可以从 [greenteapress.com/semaphores/counter.c](http://greenteapress.com/semaphores/counter.c) 下载这个程序（包括清理代码）。

如果你编译并运行这个程序，应该会看到类似这样的输出：

    Starting child at counter 0
    10000
    20000
    30000
    40000
    50000
    60000
    70000
    80000
    90000
    Child done.
    Starting child at counter 100000
    Child done.
    Checking...
    0 errors.

当然，子线程之间如何交错，取决于你的操作系统的细节，也取决于你机器上同时运行的其他程序。在上面这个例子里，一个线程从 0 一路跑到 `end`，另一个线程才开始，所以没出现同步错误一点也不奇怪。

但随着 `end` 变大，子线程之间的上下文切换也更多。在我的系统上，`end` 达到 100,000,000 时就开始出现错误了。

**问题**：用信号量保证对共享变量的互斥访问，然后重新运行程序，确认没有错误。

::: details 提示：互斥
下面是我解法里用的 `Shared` 版本：

```python
typedef struct {
  int counter;
  int end;
  int *array;
  Semaphore *mutex;  (*\label{declaremutex}*)
} Shared;

Shared *make_shared (int end)
{
  int i;
  Shared *shared = check_malloc (sizeof (Shared));

  shared->counter = 0;
  shared->end = end;

  shared->array = check_malloc (shared->end * sizeof(int));
  for (i=0; i<shared->end; i++) {
    shared->array[i] = 0;
  }
  shared->mutex = make_semaphore(1);  (*\label{initmutex}*)
  return shared;
}
```

标着 `declaremutex` 的那一行把 `mutex` 声明为信号量；标着 `initmutex` 的那一行把互斥锁初始化为 1。
:::

::: details 解答：互斥
下面是子线程代码的同步版本：

```python
void child_code (Shared *shared)
{
  while (1) {
    sem_wait(shared->mutex);
    if (shared->counter >= shared->end) {
      sem_signal(shared->mutex);
      return;
    }

    shared->array[shared->counter]++;
    shared->counter++;
    sem_signal(shared->mutex);
  }
}
```

这里没什么太让人意外的地方；唯一有点麻烦的是别忘了在 `return` 之前释放互斥锁。

你可以从 [greenteapress.com/semaphores/counter_mutex.c](http://greenteapress.com/semaphores/counter_mutex.c) 下载这个解法。
:::

## 自己实现信号量

使用 Pthreads 的程序里，最常用的同步工具是互斥锁和条件变量，而不是信号量。关于这些工具的解释，我推荐 Butenhof 的 *Programming with POSIX Threads*。

**问题**：去读一读关于互斥锁和条件变量的资料，然后用它们写一个信号量的实现。

你的解法里可能会想用下面这些工具代码。下面是我对 Pthreads 互斥锁的封装：

```python
typedef pthread_mutex_t Mutex;

Mutex *make_mutex ()
{
  Mutex *mutex = check_malloc (sizeof(Mutex));
  int n = pthread_mutex_init (mutex, NULL);
  if (n != 0) perror_exit ("make_lock failed"); 
  return mutex;
}

void mutex_lock (Mutex *mutex)
{
  int n = pthread_mutex_lock (mutex);
  if (n != 0) perror_exit ("lock failed");
}

void mutex_unlock (Mutex *mutex)
{
  int n = pthread_mutex_unlock (mutex);
  if (n != 0) perror_exit ("unlock failed");
}
```

还有我对 Pthread 条件变量的封装：

```python
typedef pthread_cond_t Cond;

Cond *make_cond ()
{
  Cond *cond = check_malloc (sizeof(Cond)); 
  int n = pthread_cond_init (cond, NULL);
  if (n != 0) perror_exit ("make_cond failed");
  return cond;
}

void cond_wait (Cond *cond, Mutex *mutex)
{
  int n = pthread_cond_wait (cond, mutex);
  if (n != 0) perror_exit ("cond_wait failed");
}

void cond_signal (Cond *cond)
{
  int n = pthread_cond_signal (cond);
  if (n != 0) perror_exit ("cond_signal failed");
}
```

::: details 提示：信号量实现
下面是我给信号量用的结构体定义：

```python
typedef struct {
  int value, wakeups;
  Mutex *mutex;
  Cond *cond;
} Semaphore;
```

`value` 是信号量的值。`wakeups` 统计尚未兑现的信号数量，也就是已经被唤醒、但还没恢复执行的线程数。之所以需要 `wakeups`，是为了保证我们的信号量满足性质 3（见“性质”一节）。

`mutex` 负责对 `value` 和 `wakeups` 的互斥访问；`cond` 则是线程在信号量上等待时所等待的那个条件变量。

下面是这个结构体的初始化代码：

```python
Semaphore *make_semaphore (int value)
{
  Semaphore *semaphore = check_malloc (sizeof(Semaphore));
  semaphore->value = value;
  semaphore->wakeups = 0;
  semaphore->mutex = make_mutex ();
  semaphore->cond = make_cond ();
  return semaphore;
}
```
:::

### 信号量实现

下面是我用 Pthread 的互斥锁和条件变量实现的信号量：

```python
void sem_wait (Semaphore *semaphore)
{
  mutex_lock (semaphore->mutex);                 (*\label{sementer}*)
  semaphore->value--;

  if (semaphore->value < 0) {
    do {                                                (*\label{dowhile}*)
      cond_wait (semaphore->cond, semaphore->mutex);
    } while (semaphore->wakeups < 1);
    semaphore->wakeups--;
  }
  mutex_unlock (semaphore->mutex);
}

void sem_signal (Semaphore *semaphore)
{
  mutex_lock (semaphore->mutex);
  semaphore->value++;

  if (semaphore->value <= 0) {
    semaphore->wakeups++;
    cond_signal (semaphore->cond);
  }
  mutex_unlock (semaphore->mutex);
}
```

这些内容大部分都很直白；唯一可能有点绕的是标着 `dowhile` 的那个 `do...while` 循环。这样使用条件变量并不常见，但在这个场景下是必要的。

**问题**：为什么不能把这个 `do...while` 循环换成 `while` 循环？

### 信号量实现细节

如果换成 `while` 循环，这个实现就不再满足性质 3。一个线程有可能发完信号之后转一圈，又把自己发出的信号接走了。

而用 `do...while` 循环，就可以保证[^1]：当一个线程发出信号时，某个正在等待的线程一定能收到这个信号，即使有另一个线程在某个等待线程恢复执行之前抢到了标着 `sementer` 那一行的互斥锁。

[^1]: 嗯，差不多是这样。事实证明，一次时机恰到好处的虚假唤醒（spurious wakeup，见 <http://en.wikipedia.org/wiki/Spurious_wakeup>）会破坏这个保证。
