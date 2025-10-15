/**
 * 百度统计工具类
 * 使用 Measurement Protocol 进行数据上报
 * 
 * userId 和 sessionId 说明：
 * - userId: 用于标识唯一用户，帮助分析用户留存、活跃度等指标
 * - sessionId: 用于标识用户会话，帮助分析用户单次使用时长、页面流转等
 * - 当前使用随机生成ID，保护用户隐私的同时仍能进行有效的数据分析
 * - 可以通过chrome.storage持久化userId，实现跨会话的用户追踪
 */

// 移除 BaiduAnalyticsEvent 接口，因为不再使用自定义事件

interface BaiduAnalyticsConfig {
    siteId: string;    // 百度统计站点ID
    userId?: string;   // 用户ID
    sessionId?: string; // 会话ID
}

class BaiduAnalytics {
    private config: BaiduAnalyticsConfig;
    private baseUrl = 'https://hm.baidu.com/hm.gif';
    private userId: string;
    private sessionId: string;
    private startTime: number;

    constructor(config: BaiduAnalyticsConfig) {
        this.config = config;
        this.userId = config.userId || this.generateUserId();
        this.sessionId = config.sessionId || this.generateSessionId();
        this.startTime = Date.now();
        
        // 如果没有提供userId，尝试从存储中获取或生成新的
        if (!config.userId) {
            this.initializeUserId();
        }
    }

    /**
     * 生成用户ID
     */
    private generateUserId(): string {
        return 'user_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
    }

    /**
     * 生成HCA参数（用户标识哈希）
     */
    private generateHCA(): string {
        // 生成16位十六进制字符串
        return Array.from({length: 16}, () => Math.floor(Math.random() * 16).toString(16).toUpperCase()).join('');
    }

    /**
     * 生成会话ID
     */
    private generateSessionId(): string {
        return 'session_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
    }

    /**
     * 初始化用户ID，优先从chrome.storage获取，如果没有则生成新的并保存
     */
    private async initializeUserId(): Promise<void> {
        try {
            if (typeof chrome !== 'undefined' && chrome.storage) {
                const result = await chrome.storage.local.get(['baidu_analytics_user_id']);
                if (result.baidu_analytics_user_id) {
                    this.userId = result.baidu_analytics_user_id;
                } else {
                    // 生成新的userId并保存
                    const newUserId = this.generateUserId();
                    await chrome.storage.local.set({ baidu_analytics_user_id: newUserId });
                    this.userId = newUserId;
                }
            }
        } catch (error) {
            console.warn('Failed to initialize userId from storage:', error);
            // 如果存储失败，使用随机生成的userId
        }
    }

    /**
     * 构建基础参数
     */
    private buildBaseParams(): URLSearchParams {
        const params = new URLSearchParams();
        
        // 必需参数 - 按照百度统计标准格式
        params.append('si', this.config.siteId); // 站点ID
        params.append('v', '1.3.2'); // 版本号，使用标准版本
        params.append('rnd', Math.floor(Math.random() * 2147483647).toString()); // 随机数
        params.append('lt', this.startTime.toString()); // 页面加载时间
        
        // 用户标识相关
        params.append('hca', this.generateHCA()); // 用户标识哈希
        
        // 基础配置参数
        params.append('ck', '1'); // Cookie启用状态
        params.append('cl', '24-bit'); // 颜色深度
        params.append('ja', '0'); // Java启用状态
        params.append('ln', (typeof navigator !== 'undefined' && navigator.language) || 'zh-cn'); // 语言
        params.append('lo', '0'); // 本地时间偏移
        
        // 屏幕分辨率和视窗大小
        if (typeof screen !== 'undefined') {
            params.append('ds', `${screen.width}x${screen.height}`); // 屏幕分辨率
            params.append('vl', typeof window !== 'undefined' ? `${window.innerWidth}` : '1151'); // 视窗宽度
        } else {
            params.append('ds', '1792x1120'); // 默认分辨率
            params.append('vl', '998'); // 默认视窗宽度
        }
        
        params.append('et', '0'); // 事件类型
        params.append('lv', '2'); // 日志版本
        params.append('api', '4_0'); // API版本
        params.append('sn', Math.floor(Math.random() * 99999).toString()); // 序列号
        params.append('r', '0'); // 刷新标识
        
        // 窗口宽度
        if (typeof window !== 'undefined') {
            params.append('ww', window.innerWidth.toString());
        } else {
            params.append('ww', '1151');
        }
        
        return params;
    }

    /**
     * 发送页面浏览事件
     */
    async trackPageView(page: string, title?: string): Promise<void> {
        try {
            const params = this.buildBaseParams();
            params.append('cc', '1'); // 事件类型：页面浏览
            
            // 页面相关参数
            const baseUrl = 'https://feishu-extension.sancijun.com';
            const currentUrl = `${baseUrl}${page}`;
            
            params.append('u', currentUrl); // 当前页面URL
            params.append('su', baseUrl + '/'); // 来源URL
            
            if (title) {
                params.append('tt', encodeURIComponent(title)); // 页面标题
            } else {
                params.append('tt', encodeURIComponent('三此君')); // 默认标题
            }
            
            await this.sendRequest(params);
        } catch (error) {
            console.warn('百度统计页面浏览事件发送失败:', error);
        }
    }



    /**
     * 发送扩展安装事件
     */
    async trackInstall(): Promise<void> {
        await this.trackPageView('/extension/installed', '扩展安装');
    }

    /**
     * 发送扩展卸载事件
     */
    async trackUninstall(): Promise<void> {
        await this.trackPageView('/extension/uninstalled', '扩展卸载');
    }

    /**
     * 发送功能使用事件
     */
    async trackFeatureUsage(feature: string): Promise<void> {
        const pagePath = `/feature/${feature}`;
        const title = `功能使用-${feature}`;
        
        await this.trackPageView(pagePath, title);
    }



    /**
     * 发送错误事件
     */
    async trackError(error: string, context?: string): Promise<void> {
        const pagePath = context ? `/error/${context}/${error}` : `/error/${error}`;
        const title = `错误-${context ? context + '-' : ''}${error}`;
        
        await this.trackPageView(pagePath, title);
    }



    /**
     * 发送HTTP请求
     */
    private async sendRequest(params: URLSearchParams): Promise<void> {
        try {
            const url = `${this.baseUrl}?${params.toString()}`;
            
            // 在浏览器环境中使用原生fetch
            if (typeof fetch !== 'undefined') {
                await fetch(url, {
                    method: 'GET',
                    mode: 'no-cors', // 避免CORS问题
                    cache: 'no-cache',
                    headers: {
                        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
                        'Accept-Language': 'zh-CN,zh;q=0.9',
                        'Cache-Control': 'no-cache',
                        'Pragma': 'no-cache',
                        'Referer': 'feishu-extension.sancijun.com',
                        'User-Agent': typeof navigator !== 'undefined' ? navigator.userAgent : 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36'
                    }
                });
            } else {
                console.warn('fetch不可用，跳过数据发送');
            }
        } catch (error) {
            console.warn('百度统计数据发送失败:', error);
            // 不抛出错误，避免影响主要功能
        }
    }

    /**
     * 更新用户ID
     */
    setUserId(userId: string): void {
        this.userId = userId;
    }

    /**
     * 获取用户ID
     */
    getUserId(): string {
        return this.userId;
    }

    /**
     * 更新会话ID
     */
    setSessionId(sessionId: string): void {
        this.sessionId = sessionId;
    }

    /**
     * 获取会话ID
     */
    getSessionId(): string {
        return this.sessionId;
    }
}

// 创建全局实例
const analytics = new BaiduAnalytics({
    siteId: 'ffc9ba1479243f7fc0cb43a144253cba'
});

export { BaiduAnalytics, analytics };
export type { BaiduAnalyticsConfig };