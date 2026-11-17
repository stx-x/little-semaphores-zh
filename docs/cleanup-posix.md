---
title: "清理 POSIX 线程"
---

# 清理 POSIX 线程

<div class="chap-en">Cleaning up POSIX Threads</div>

<div class="chap-en">Cleaning up POSIX Threads</div>

本节介绍一些工具代码，我靠它们让 C 里的多线程稍微好写一点。前面 C 那一节的例子都基于这些代码。

在 C 里最流行的线程标准，大概要算 POSIX 线程，简称 Pthreads。POSIX 标准定义了一套线程模型，以及创建和控制线程的接口。大多数版本的 UNIX 都提供了 Pthreads 的实现。

## 编译 Pthread 代码

使用 Pthreads 和使用大多数 C 库没什么两样：

-   在程序开头包含头文件。

-   编写调用 Pthreads 所定义函数的代码。

-   编译程序时，把它与 Pthread 库链接起来。

我的例子里包含下面这些头文件：

```python title="Headers"
#include <stdio.h>
#include <stdlib.h>
#include <pthread.h>
#include <semaphore.h>
```

前两个是标准头文件，第三个用于 Pthreads，第四个用于信号量。要在 `gcc` 里链接 Pthread 库，可以在命令行上使用 `-l` 选项：

```python
gcc -g -O2 -o array array.c -lpthread
```

这条命令带着调试信息和优化选项编译 `array.c`，与 Pthread 库链接，并生成一个名为 `array` 的可执行文件。

如果你习惯了像 Python 这样提供异常处理的语言，多半会觉得 C 这类语言很烦——它要求你显式检查错误情况。我通常的缓解办法，是把库函数调用和它的错误检查代码一起包进自己的函数里。比如下面这个会检查返回值的 `malloc` 版本。

```python
void *check_malloc(int size)
{
  void *p = malloc (size);
  if (p == NULL) {
    perror ("malloc failed");
    exit (-1);
  }
  return p;
}
```

## 创建线程

对我将要使用的 Pthread 函数，我也做了同样的处理。下面是我对 `pthread_create` 的包装：

```python
pthread_t make_thread(void *(*entry)(void *), Shared *shared)
{
  int n;
  pthread_t thread;

  n = pthread_create (&thread, NULL, entry, (void *)shared);
  if (n != 0) {
    perror ("pthread_create failed");
    exit (-1);
  }
  return thread;
}
```

`pthread_create` 的返回类型是 `pthread_t`，你可以把它看成新线程的句柄。`pthread_t` 的内部实现你用不着操心，但你必须知道它具有基本类型（primitive type）的语义[^1]。也就是说，你可以把线程句柄看作一个不可变的值，随意复制或按值传递都不会引起问题。我现在特意点出这一点，是因为信号量并不具备这种性质——马上就会讲到。

如果 `pthread_create` 成功，它返回 0，我的函数就返回新线程的句柄。如果出错，`pthread_create` 返回一个错误码，我的函数打印错误信息然后退出。

`pthread_create` 的参数需要解释一下。先说第二个：`Shared` 是一个用户定义的结构体，用来存放共享变量。下面这条 `typedef` 语句创建了这个新类型：

```python
typedef struct {
  int counter;
} Shared;
```

在这个例子里，唯一的共享变量就是 `counter`。`make_shared` 为 `Shared` 结构体分配空间，并初始化其中的内容：

```python
Shared *make_shared ()
{
  int i;
  Shared *shared = check_malloc (sizeof (Shared));
  shared->counter = 0;
  return shared;
}
```

有了共享数据结构，我们再回到 `pthread_create`。第一个参数是一个函数指针，这个函数接受一个 `void` 指针，返回一个 `void` 指针。如果声明这种类型的语法让你看得眼睛流血，你并不孤单。总之，这个参数的作用是指定新线程从哪个函数开始执行。按惯例，这个函数命名为 `entry`：

```python
void *entry (void *arg)
{
  Shared *shared = (Shared *) arg;
  child_code (shared);
  pthread_exit (NULL);
}
```

`entry` 的参数必须声明为 `void` 指针，但在这个程序里我们知道它实际上是指向 `Shared` 结构体的指针，所以可以相应地做类型转换，再传给真正干活的 `child_code`。

`child_code` 返回后，我们调用 `pthread_exit`，它可以用来向任何与这个线程 join 的线程（通常是父线程）传递一个值。在这个例子里，子线程没什么好说的，所以我们传 `NULL`。

## 等待线程结束

当一个线程想等待另一个线程结束时，它调用 `pthread_join`。下面是我对 `pthread_join` 的包装：

```python
void join_thread (pthread_t thread)
{
  int ret = pthread_join (thread, NULL);
  if (ret == -1) {
    perror ("pthread_join failed");
    exit (-1);
  }
}
```

参数是你要等待的那个线程的句柄。我的函数所做的，不过是调用 `pthread_join` 并检查结果。

## 信号量

POSIX 标准规定了一套信号量接口。这套接口并不属于 Pthreads，但大多数实现了 Pthreads 的 UNIX 也提供信号量。如果你手里有 Pthreads 却没有信号量，也可以自己造一个；参见讲如何自己实现信号量的那一节。

POSIX 信号量的类型是 `sem_t`。这个类型的实现你用不着了解，但你必须知道它具有结构体语义——也就是说，如果你把它赋给一个变量，你其实是在复制结构体的内容。复制信号量几乎肯定是个坏主意。在 POSIX 里，副本的行为是未定义的。

在我的程序里，我用大写字母来表示具有结构体语义的类型，并且总是用指针来操作它们。好在给 `sem_t` 套一层包装、让它表现得像个正经对象是件容易的事。下面是创建并初始化信号量的 `typedef` 和包装函数：

```python
typedef sem_t Semaphore;

Semaphore *make_semaphore (int n)
{
  Semaphore *sem = check_malloc (sizeof(Semaphore));
  int ret = sem_init(sem, 0, n);
  if (ret == -1) {
    perror ("sem_init failed");
    exit (-1);    
  }
  return sem;
}
```

`make_semaphore` 以信号量的初始值作为参数。它为 `Semaphore` 分配空间，初始化它，然后返回指向 `Semaphore` 的指针。

`sem_init` 用的是老式的 UNIX 错误报告方式，也就是出错时返回 -1。这些包装函数的一个好处是，我们不必再记住哪个函数用哪种报错风格。

有了这些定义，我们写出的 C 代码就几乎像一门真正的编程语言了：

```python
Semaphore *mutex = make_semaphore(1);
sem_wait(mutex);
sem_post(mutex);
```

烦人的是，POSIX 信号量用 `post` 而不是 `signal`，不过我们可以改过来：

```python
int sem_signal(Semaphore *sem)
{
  return sem_post(sem);
}
```

清理到此为止，够用了。

[^1]: 比如整数——在我所知道的所有实现里，`pthread_t` 就是一个整数。
