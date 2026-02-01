# 设计文档

## 概述

番茄钟应用是一个Windows桌面悬浮窗应用，采用轻干扰的悬浮岛设计风格。应用基于Electron框架构建，提供跨平台能力的同时保持原生体验。核心功能包括番茄钟计时、专注事项记录、数据持久化和统计展示。

### 技术栈选择

- **Electron**: 提供跨平台桌面应用框架，支持Windows原生API
- **React**: 构建用户界面组件
- **TypeScript**: 提供类型安全和更好的开发体验
- **SQLite**: 轻量级本地数据库，用于存储专注记录
- **Tailwind CSS**: 快速构建现代化UI样式

## 架构

### 整体架构

应用采用经典的Electron架构，分为主进程和渲染进程：

```
┌─────────────────────────────────────────┐
│           主进程 (Main Process)          │
│  ┌─────────────────────────────────┐   │
│  │   窗口管理器 (Window Manager)    │   │
│  └─────────────────────────────────┘   │
│  ┌─────────────────────────────────┐   │
│  │   数据服务 (Data Service)        │   │
│  │   - SQLite 数据库操作            │   │
│  └─────────────────────────────────┘   │
│  ┌─────────────────────────────────┐   │
│  │   系统托盘 (Tray Manager)        │   │
│  └─────────────────────────────────┘   │
└─────────────────────────────────────────┘
              │ IPC 通信
              ↓
┌─────────────────────────────────────────┐
│        渲染进程 (Renderer Process)       │
│  ┌─────────────────────────────────┐   │
│  │   计时器组件 (Timer Component)   │   │
│  └─────────────────────────────────┘   │
│  ┌─────────────────────────────────┐   │
│  │   统计组件 (Stats Component)     │   │
│  └─────────────────────────────────┘   │
│  ┌─────────────────────────────────┐   │
│  │   设置组件 (Settings Component)  │   │
│  └─────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

### 数据流

1. 用户在渲染进程中操作UI
2. 渲染进程通过IPC向主进程发送请求
3. 主进程处理业务逻辑并操作数据库
4. 主进程通过IPC返回结果给渲染进程
5. 渲染进程更新UI显示

## 组件和接口

### 1. 窗口管理器 (Window Manager)

负责创建和管理悬浮窗，处理窗口属性和行为。

```typescript
interface WindowManager {
  // 创建主悬浮窗
  createMainWindow(): BrowserWindow;
  
  // 设置窗口置顶状态
  setAlwaysOnTop(enabled: boolean): void;
  
  // 保存窗口位置
  saveWindowPosition(x: number, y: number): void;
  
  // 恢复窗口位置
  restoreWindowPosition(): { x: number; y: number };
  
  // 设置窗口透明度
  setOpacity(opacity: number): void;
}
```

**窗口配置**：
- 无边框窗口 (frameless)
- 可拖动
- 圆角边框 (通过CSS实现)
- 初始大小: 320x180 像素
- 支持透明背景

### 2. 计时器服务 (Timer Service)

管理番茄钟计时逻辑。

```typescript
interface TimerService {
  // 开始计时
  start(duration: number, taskName: string): void;
  
  // 暂停计时
  pause(): void;
  
  // 恢复计时
  resume(): void;
  
  // 重置计时器
  reset(): void;
  
  // 获取当前状态
  getState(): TimerState;
  
  // 订阅计时器更新
  onTick(callback: (remainingSeconds: number) => void): void;
  
  // 订阅计时器完成事件
  onComplete(callback: () => void): void;
}

interface TimerState {
  status: 'idle' | 'running' | 'paused';
  remainingSeconds: number;
  totalSeconds: number;
  taskName: string;
  startTime: Date | null;
}
```

**计时器行为**：
- 默认时长: 25分钟（1500秒）
- 每秒触发一次tick事件
- 倒计时结束时触发complete事件
- 支持暂停和恢复

### 3. 数据服务 (Data Service)

处理所有数据持久化操作。

```typescript
interface DataService {
  // 初始化数据库
  initialize(): Promise<void>;
  
  // 保存专注时段
  saveFocusSession(session: FocusSession): Promise<void>;
  
  // 获取指定日期的专注记录
  getFocusSessions(date: Date): Promise<FocusSession[]>;
  
  // 获取日期范围内的统计数据
  getStatistics(startDate: Date, endDate: Date): Promise<Statistics>;
  
  // 保存应用设置
  saveSettings(settings: AppSettings): Promise<void>;
  
  // 加载应用设置
  loadSettings(): Promise<AppSettings>;
}

interface FocusSession {
  id: string;
  taskName: string;
  duration: number; // 秒
  startTime: Date;
  endTime: Date;
  completed: boolean;
}

interface Statistics {
  totalFocusTime: number; // 秒
  sessionCount: number;
  sessions: FocusSession[];
}

interface AppSettings {
  alwaysOnTop: boolean;
  windowPosition: { x: number; y: number };
  defaultDuration: number; // 秒
  soundEnabled: boolean;
  opacity: number;
}
```

**数据库模式**：

```sql
-- 专注时段表
CREATE TABLE focus_sessions (
  id TEXT PRIMARY KEY,
  task_name TEXT NOT NULL,
  duration INTEGER NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  completed INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

-- 应用设置表
CREATE TABLE app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 索引
CREATE INDEX idx_focus_sessions_date ON focus_sessions(date(start_time));
```

### 4. 统计模块 (Statistics Module)

计算和展示专注统计数据。

```typescript
interface StatisticsModule {
  // 计算今日统计
  calculateTodayStats(): Promise<DailyStats>;
  
  // 计算指定日期统计
  calculateDailyStats(date: Date): Promise<DailyStats>;
  
  // 计算周统计
  calculateWeeklyStats(weekStart: Date): Promise<WeeklyStats>;
}

interface DailyStats {
  date: Date;
  totalFocusTime: number; // 秒
  sessionCount: number;
  sessions: FocusSession[];
  completionRate: number; // 0-1
}

interface WeeklyStats {
  weekStart: Date;
  weekEnd: Date;
  dailyStats: DailyStats[];
  totalFocusTime: number;
  averageDailyFocusTime: number;
}
```

### 5. 通知服务 (Notification Service)

处理系统通知和提示音。

```typescript
interface NotificationService {
  // 显示系统通知
  showNotification(title: string, body: string): void;
  
  // 播放提示音
  playSound(soundType: 'complete' | 'warning'): void;
  
  // 检查通知权限
  checkPermission(): Promise<boolean>;
  
  // 请求通知权限
  requestPermission(): Promise<boolean>;
}
```

## 数据模型

### 核心实体

**FocusSession（专注时段）**：
- id: 唯一标识符（UUID）
- taskName: 任务名称
- duration: 实际专注时长（秒）
- startTime: 开始时间
- endTime: 结束时间
- completed: 是否完成（true/false）

**AppSettings（应用设置）**：
- alwaysOnTop: 是否置顶
- windowPosition: 窗口位置 {x, y}
- defaultDuration: 默认时长（秒）
- soundEnabled: 是否启用提示音
- opacity: 非活动状态透明度（0-1）

### 数据验证规则

1. **taskName**: 
   - 非空字符串
   - 最大长度100字符
   - 空输入时使用"未命名任务"

2. **duration**:
   - 正整数
   - 范围: 60-7200秒（1分钟-2小时）

3. **时间戳**:
   - 使用ISO 8601格式
   - endTime必须晚于startTime

4. **opacity**:
   - 浮点数
   - 范围: 0.3-1.0

## 正确性属性

*属性是一个特征或行为，应该在系统的所有有效执行中保持为真——本质上是关于系统应该做什么的正式陈述。属性作为人类可读规范和机器可验证正确性保证之间的桥梁。*


### 属性 1：计时器状态转换正确性

*对于任何*初始时长，当启动计时器时，计时器状态应该从"idle"变为"running"，且剩余时间应该等于初始时长

**验证需求：需求 1.1**

### 属性 2：计时器递减正确性

*对于任何*运行中的计时器，经过N秒后，剩余时间应该减少N秒（在误差范围内）

**验证需求：需求 1.2**

### 属性 3：计时器完成事件触发

*对于任何*计时器，当剩余时间到达0时，应该触发完成事件

**验证需求：需求 1.3**

### 属性 4：暂停保持不变性

*对于任何*运行中的计时器，暂停操作后剩余时间应该保持不变

**验证需求：需求 1.4**

### 属性 5：重置恢复初始值

*对于任何*计时器状态，重置操作应该将剩余时间恢复到初始设定值，状态恢复为"idle"

**验证需求：需求 1.5**

### 属性 6：空任务名称默认值

*对于任何*由纯空白字符组成的任务名称（包括空字符串、空格、制表符等），系统应该将其替换为"未命名任务"

**验证需求：需求 2.3**

### 属性 7：专注时段数据往返一致性

*对于任何*有效的专注时段数据，保存到本地存储后再加载，应该得到等价的数据对象（任务名称、时长、时间戳都相同）

**验证需求：需求 2.2, 2.4, 3.1, 3.2**

### 属性 8：损坏数据恢复能力

*对于任何*损坏的数据库文件，应用初始化时应该能够检测到错误并创建新的数据库，而不是崩溃

**验证需求：需求 3.3**

### 属性 9：写入失败错误处理

*对于任何*模拟的写入失败场景，系统应该捕获错误并返回错误状态，而不是静默失败

**验证需求：需求 3.4**

### 属性 10：统计数据计算正确性

*对于任何*给定日期的专注记录集合，计算的总时长应该等于所有记录时长之和，计数应该等于记录数量

**验证需求：需求 4.1, 4.2**

### 属性 11：时间排序不变性

*对于任何*专注记录集合，无论输入顺序如何，按时间排序后的输出应该满足：每条记录的开始时间都不早于前一条记录

**验证需求：需求 4.3**

### 属性 12：日期过滤正确性

*对于任何*日期和专注记录集合，按日期过滤后的结果应该只包含该日期的记录（基于开始时间的日期部分）

**验证需求：需求 4.4**

### 属性 13：窗口位置往返一致性

*对于任何*有效的窗口位置坐标，保存后重新加载应该得到相同的坐标值

**验证需求：需求 5.2, 5.3**

### 属性 14：应用设置往返一致性

*对于任何*有效的应用设置对象（包括置顶状态、透明度等），保存到本地存储后再加载，应该得到等价的设置对象

**验证需求：需求 6.3, 6.4**

### 属性 15：置顶状态设置正确性

*对于任何*置顶状态值（true或false），设置后查询窗口的alwaysOnTop属性应该返回相同的值

**验证需求：需求 6.1, 6.2**

### 属性 16：透明度状态转换正确性

*对于任何*窗口，当焦点状态改变时，透明度应该在配置的非活动透明度和1.0（完全不透明）之间正确切换

**验证需求：需求 5.5, 7.1, 7.2**

### 属性 17：运行时界面信息完整性

*对于任何*运行中的计时器，渲染的界面内容应该包含剩余时间和任务名称这两个必要信息

**验证需求：需求 7.5**

### 属性 18：初始化失败安全退出

*对于任何*模拟的初始化失败场景（如数据库连接失败），应用应该记录错误并返回错误状态，而不是进入不一致状态

**验证需求：需求 8.2**

### 属性 19：关闭时数据保存完整性

*对于任何*应用状态，执行关闭操作时，所有待保存的数据（包括运行中的计时器状态）应该被持久化

**验证需求：需求 8.3**

## 错误处理

### 错误类型

1. **数据库错误**
   - 连接失败
   - 查询失败
   - 写入失败
   - 数据损坏

2. **文件系统错误**
   - 权限不足
   - 磁盘空间不足
   - 文件被占用

3. **运行时错误**
   - 计时器异常
   - IPC通信失败
   - 渲染进程崩溃

### 错误处理策略

**数据库错误**：
- 初始化失败：显示错误对话框，提供重试选项
- 查询失败：返回空结果，记录日志
- 写入失败：显示通知，保留内存中的数据，稍后重试
- 数据损坏：备份损坏文件，创建新数据库

**文件系统错误**：
- 权限不足：提示用户检查权限
- 磁盘空间不足：提示用户清理空间
- 文件被占用：等待并重试，超时后提示用户

**运行时错误**：
- 计时器异常：重置计时器，记录日志
- IPC通信失败：重试3次，失败后提示用户重启应用
- 渲染进程崩溃：自动重启渲染进程，恢复上次状态

### 错误日志

所有错误都应该记录到日志文件：
- 位置：`%APPDATA%/pomodoro-timer/logs/`
- 格式：JSON Lines
- 轮转：每天一个文件，保留最近30天
- 内容：时间戳、错误类型、错误消息、堆栈跟踪

## 测试策略

### 双重测试方法

本项目采用单元测试和基于属性的测试相结合的方法，以确保全面的代码覆盖：

- **单元测试**：验证特定示例、边缘情况和错误条件
- **基于属性的测试**：验证所有输入的通用属性

两者是互补的，都是必需的：
- 单元测试捕获具体的错误
- 基于属性的测试验证一般正确性

### 基于属性的测试配置

**测试库选择**：
- 使用 `fast-check` 库进行基于属性的测试（TypeScript/JavaScript生态系统的标准选择）
- 使用 `vitest` 作为测试运行器

**配置要求**：
- 每个属性测试最少运行 100 次迭代（由于随机化）
- 每个测试必须使用注释标签引用设计文档中的属性
- 标签格式：`// Feature: pomodoro-timer, Property {number}: {property_text}`

**测试组织**：
- 每个正确性属性必须由单个基于属性的测试实现
- 属性测试应该放在对应实现代码附近（尽早捕获错误）
- 使用描述性的测试名称，明确说明被测试的属性

### 单元测试策略

**重点领域**：
- 具体示例：演示正确行为的典型用例
- 边缘情况：空输入、边界值、极端情况
- 错误条件：无效输入、失败场景、异常处理
- 集成点：组件之间的交互

**避免过度测试**：
- 不要为基于属性的测试已经覆盖的场景编写大量单元测试
- 专注于基于属性的测试难以表达的特定场景
- 使用单元测试来记录预期行为的具体示例

### 测试覆盖目标

- 核心业务逻辑：90%以上代码覆盖率
- 数据服务层：100%覆盖率（关键路径）
- UI组件：70%以上覆盖率（重点测试逻辑，不是样式）
- 错误处理：所有错误路径都有测试

### 测试环境

**单元测试环境**：
- 使用内存SQLite数据库（`:memory:`）
- Mock Electron API
- Mock文件系统操作

**集成测试环境**：
- 使用临时目录存储测试数据
- 使用Electron的测试工具
- 清理测试数据

### 持续集成

- 所有测试在每次提交时运行
- 基于属性的测试使用固定种子以确保可重现性
- 失败的测试应该阻止合并

## 性能考虑

### 响应时间目标

- 应用启动：< 2秒
- 计时器更新：< 16ms（60 FPS）
- 数据库查询：< 100ms
- 统计计算：< 500ms

### 内存使用

- 空闲状态：< 100MB
- 运行状态：< 150MB
- 数据库缓存：< 10MB

### 优化策略

1. **计时器优化**：
   - 使用`setInterval`而不是递归`setTimeout`
   - 批量更新UI，避免频繁重绘

2. **数据库优化**：
   - 使用索引加速日期查询
   - 批量插入数据
   - 使用事务保证一致性

3. **UI优化**：
   - 使用React.memo避免不必要的重渲染
   - 虚拟化长列表（统计界面）
   - 防抖窗口拖动事件

## 安全考虑

### 数据安全

- 所有数据存储在用户本地，不上传到服务器
- 数据库文件权限设置为仅当前用户可读写
- 敏感操作（如删除数据）需要用户确认

### 输入验证

- 所有用户输入都进行验证和清理
- 任务名称长度限制，防止过长输入
- 时长值范围检查，防止无效值

### 进程隔离

- 主进程和渲染进程分离
- 禁用渲染进程的Node.js集成
- 使用contextBridge安全地暴露API

## 可扩展性

### 未来功能预留

设计中预留了以下扩展点：

1. **自定义时长**：
   - 数据模型已支持任意时长
   - UI可以添加时长选择器

2. **休息提醒**：
   - 计时器服务可以支持多种计时器类型
   - 通知服务可以处理不同类型的提醒

3. **数据导出**：
   - 数据服务接口可以添加导出方法
   - 支持CSV、JSON等格式

4. **主题定制**：
   - UI组件使用CSS变量
   - 可以轻松添加主题切换功能

5. **云同步**：
   - 数据模型包含唯一ID
   - 可以添加同步服务层

### 插件架构

虽然初始版本不包含插件系统，但架构设计允许未来添加：
- 事件系统：计时器事件、数据变更事件
- 钩子系统：允许插件在特定时机执行代码
- API层：为插件提供安全的API访问

## 部署和分发

### 打包

使用`electron-builder`打包应用：
- Windows：生成`.exe`安装程序和便携版
- 代码签名：使用证书签名，避免安全警告
- 自动更新：集成`electron-updater`

### 安装

- 默认安装路径：`C:\Program Files\Pomodoro Timer`
- 用户数据路径：`%APPDATA%\pomodoro-timer`
- 开机自启动：可选，默认关闭

### 更新策略

- 检查更新：启动时检查，每天最多一次
- 下载更新：后台下载，不干扰用户
- 安装更新：提示用户，重启后安装
- 回滚机制：保留上一版本，支持回滚
