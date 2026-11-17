# 信号量小书（中文全译）

《The Little Book of Semaphores》第二版 · Allen B. Downey · Green Tea Press

**在线阅读：https://stx-x.github.io/little-semaphores-zh/**

## 关于这本书

用信号量解决并发同步问题的经典小书。作者的方法是：先归纳出若干**同步模式**（发信号、会合、互斥、复用、屏障、队列），再用这些模式拼装出复杂问题的解法。

每道题都分三段：**问题 → 提示 → 解答**。网页版把后两段做成了可折叠块，方便先自己动手。

## 目录

| 部分 | 章节 |
|---|---|
| 基础 | 导论、信号量、基本同步模式 |
| 问题集 | 经典同步问题、不太经典的问题、非经典问题、远非经典的问题 |
| 代码实现 | Python 中的同步、C 语言中的同步、清理 Python 线程、清理 POSIX 线程 |

约 3.8 万汉字，200 段代码，75 个可折叠的提示/解答。

## 本地构建

```bash
npm install
npm run dev
npm run build
```

## 许可

原书由 Allen B. Downey 以 [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/) 发布，允许复制、分发与修改，需署名、相同方式共享、非商业使用。

本译本遵循同一协议：
- 署名：原作者 Allen B. Downey，译者 stx-x
- 非商业：仅供学习交流
- 相同方式共享：本译本同样以 CC BY-NC-SA 4.0 发布

原书：https://greenteapress.com/wp/semaphores/
源码：https://github.com/AllenDowney/LittleBookOfSemaphores
