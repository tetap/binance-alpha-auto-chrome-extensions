<div align="center">
  <picture>
      <img alt="Logo" src="./docs/app.png" />
  </picture>

## 🚀 邀请链接 [点击直达](https://accounts.maxweb.black/register?ref=TETAP)
## 🚀 邀请链接 [点击直达](https://www.maxweb.black/referral/earn-together/refer-in-hotsummer/claim?hl=zh-CN&ref=GRO_20338_X9GMF&utm_source=default)
## 🚀 邀请链接 [点击直达](https://www.maxweb.black/activity/referral-entry/CPA?ref=CPA_00XHV1H7W5)

## 项目介绍

一个基于 Chrome 扩展的 Binance Alpha 流水刷取工具，专为刷交易流水和获取空投积分设计。通过反向交易操作和监控价格，自动生成流水数据，同时记录操作日志，帮助用户快速积累积分。

</div>

## 功能特点

- **流水刷取**：自动生成交易流水，快速累计 Alpha 流水。
- **空投积分**：通过流水刷取帮助获取空投积分。
- **反向订单**：可设置小数点保留和反向价格，安全生成流水。
- **价格波动检测**：连续监控价格，支持保守模式，防止异常波动。
- **日志输出**：实时显示每轮操作日志，方便追踪流水和积分情况。
- **操作损耗统计**：显示每轮操作对账户余额的影响。
- **多轮操作支持**：可设置循环次数，一键生成多轮流水。

## 安装

### 使用release版本

1. **访问 Releases 页面**  
   打开你的仓库 GitHub Releases 页面：[https://github.com/你的用户名/你的仓库/releases](https://github.com/你的用户名/你的仓库/releases)

2. **下载最新版本**  
   - 在最新 Release 下找到 `extension.zip` 文件。  
   - 点击下载到本地电脑。  

3. **解压文件**  
   - 将下载的 `extension.zip` 解压到一个文件夹，例如 `binance-auto-extension/`。  

4. **在 Chrome 中加载扩展**  
   1. 打开 Chrome 浏览器，输入 `chrome://extensions/` 并回车。  
   2. 开启右上角的 **开发者模式**。  
   3. 点击 **加载已解压的扩展程序**。  
   4. 选择第 3 步解压的文件夹 `binance-auto-extension/`。  

5. **启动扩展**  
   - 成功加载后，浏览器右上角会显示扩展图标。  
   - 点击图标即可打开 **币安 Alpha 小助手** 页面，开始流水刷取操作。  




### 手动打包

1. 克隆本仓库：

```bash
git clone https://github.com/tetap/binance-alpha-auto-chrome-extensions
```

2. 安装依赖：

```bash
pnpm install
```

3. 编译代码：

```bash
pnpm build
```

4. 加载扩展：
- 打开 Chrome 浏览器，访问 `chrome://extensions/` 页面。

5. 打开开发者模式，点击 `加载已解压的扩展程序`，选择 `binance-alpha-auto-chrome-extensions/dist` 文件夹。

6. 打开 Binance 交易页面，点击扩展图标，打开弹窗。

<picture>
    <img alt="Logo" src="./docs/fixed.png" />
</picture>

7. 填写相关参数，点击 `执行` 开始刷取。


<picture>
    <img alt="Logo" src="./docs/end.png" />
</picture>


## 模式介绍

### 买入价模式 

适用于快速刷流水，适用于稳定币，稳定的情况下可快速出入，达到快速刷取流水目的

<picture>
    <img alt="Logo" src="./docs/buy.png" />
</picture>


### 卖出价模式

在波动性比较大的币中推荐使用，避免极端情况发生。 偶尔还有意想不到的回报，效率较低。

<picture>
    <img alt="Logo" src="./docs/sell.png" />
</picture>
