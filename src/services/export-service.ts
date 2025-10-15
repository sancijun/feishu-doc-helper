
import type { PlasmoCSConfig } from 'plasmo';
import { message } from 'antd';
import { 
    getCookies,
    fetchWikiSpaces,
    fetchFolders,
    fetchShareFolders,
    fetchChildrenList,
    fetchMySpaceFileList,
    fetchWikiNodeChildren
} from '../api/feishu-api';
import {
    sleep, 
    getLocalStorageData, 
    copy 
} from '../utils/common';
import { analytics } from '../utils/baidu-analytics';
import type {
    FeishuFile,
    FeishuFolder,
    WikiSpace,
    WikiNode,
    WikiTreeResponse,
    TreeDataNode,
    TreeNode,
    FeishuApiResponse,
    ExportTaskResponse,
    ExportResultResponse
} from '../types/feishu';

export const config: PlasmoCSConfig = {
    matches: ["https://*.feishu.cn/drive/*"],
    run_at: "document_idle"
}

/**
 * @description 初始化消息监听
 */
function initMessageListener() {
    try {
        console.log('initMessageListener');
        // 监听 service worker 消息
        chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
            if (msg.alert) {
                message.error(msg.alert, 10);
                sendResponse({ succ: 1 });
            } else if (msg.content) {
                copy(msg.content);
            }
        });
    } catch (error) {
        console.error('initMessageListener error:', error);
    }
}

/**
 * @description 构建树形结构的辅助函数
 * @param files 文件列表
 * @param folders 文件夹列表
 * @returns TreeNode[] 树形结构
 */
function buildTreeStructure(files: FeishuFile[], folders: FeishuFolder[]): TreeNode[] {
    try {
        const nodeMap = new Map<string, TreeNode>();
        const rootNodes: TreeNode[] = [];

        // 首先创建所有文件夹节点
        folders.forEach(folder => {
            // 检查文件夹数据的有效性
            if (!folder.obj_token || !folder.name) {
                console.warn('跳过无效文件夹:', folder);
                return;
            }
            
            const node: TreeNode = {
                key: folder.obj_token,
                value: folder.obj_token,
                label: folder.name,
                type: 'folder',
                obj_token: folder.obj_token,
                path: folder.path,
                children: []
            };
            nodeMap.set(folder.obj_token, node);
        });

        // 添加文件节点
        files.forEach(file => {
            // 检查文件数据的有效性
            if (!file.obj_token || !file.name) {
                console.warn('跳过无效文件:', file);
                return;
            }
            
            const fileNode: TreeNode = {
                key: file.obj_token,
                value: file.obj_token,
                label: file.name,
                type: 'file',
                obj_token: file.obj_token,
                path: file.path,
                obj_type: file.obj_type,
                url: file.url
            };

            // 找到父文件夹并添加文件
            const parentNode = nodeMap.get(file.parentToken || '');
            if (parentNode) {
                parentNode.children!.push(fileNode);
            } else {
                console.warn('找不到文件的父文件夹:', file);
            }
        });

        // 构建层级关系
        folders.forEach(folder => {
            // 再次检查文件夹obj_token的有效性
            if (!folder.obj_token) {
                console.warn('文件夹obj_token为空，跳过:', folder);
                return;
            }
            
            const node = nodeMap.get(folder.obj_token);
            if (!node) return;

            // 如果是虚拟根文件夹
            if (folder.obj_token === 'virtual_my_files' || folder.obj_token === 'virtual_shared_files' || folder.obj_token === 'virtual_knowledge_base') {  
                rootNodes.push(node);
            } else if (!folder.parentToken) {
                // 如果没有父文件夹，添加到根节点
                rootNodes.push(node);
            } else {
                // 找到父文件夹
                const parentNode = nodeMap.get(folder.parentToken);
                if (parentNode) {
                    parentNode.children!.push(node);
                } else {
                    // 如果找不到父文件夹，可能是知识库的根文件夹
                    console.log('找不到父文件夹，添加到根节点:', folder);
                    rootNodes.push(node);
                }
            }
        });

        return rootNodes;
    } catch (error) {
        console.error('buildTreeStructure error:', error);
        return [];
    }
}

/**
 * @description 加载所有文件列表
 */
async function loadAllFileList() {
    console.log('new loadAllFileList');
    analytics.trackPageView('/loadAllFileList', '开始加载文件列表');
    
    const fileList: FeishuFile[] = [];
    const folderList: FeishuFolder[] = [];

    // 添加虚拟根文件夹
    folderList.push(
        { path: '我的文件夹', obj_token: 'virtual_my_files', name: '我的文件夹', parentToken: undefined, url: undefined },
        { path: '共享文件夹', obj_token: 'virtual_shared_files', name: '共享文件夹', parentToken: undefined, url: undefined },
        { path: '我的知识库', obj_token: 'virtual_knowledge_base', name: '我的知识库', parentToken: undefined, url: undefined }
    );

    // 1. 加载我的空间数据 - 放到"我的文件夹"下
    console.log('开始加载我的空间数据...');
    try {
        const mySpaceFolder = await fetchFolders();
        console.log("mySpaceFolder", mySpaceFolder);
        
        // 处理我的空间文件夹
        for (const token of mySpaceFolder.node_list) {
            const folder = mySpaceFolder.entities.nodes[token];
            folderList.push({ 
                path: `我的文件夹/${folder.name}`, 
                obj_token: folder.obj_token, 
                name: folder.name,
                parentToken: 'virtual_my_files',
                url: folder.url
            });
            await getFileList(token, `我的文件夹/${folder.name}`, fileList, folderList, 'virtual_my_files');
        }
        
        // 处理我的空间根目录文件
        await getFileList('', '我的文件夹', fileList, folderList, 'virtual_my_files');
    } catch (error) {
        console.log('加载我的空间数据时出错:', error);
        analytics.trackError('加载我的空间数据时出错');
    }

    // 2. 加载共享空间数据 - 放到"共享文件夹"下
    console.log('开始加载共享空间数据...');
    try {
        const shareSpaceFolder = await fetchShareFolders();
        console.log("shareSpaceFolder", shareSpaceFolder);
        
        // 处理共享空间文件夹
        for (const token of shareSpaceFolder.node_list) {
            const folder = shareSpaceFolder.entities.nodes[token];
            folderList.push({ 
                path: `共享文件夹/${folder.name}`, 
                obj_token: folder.obj_token, 
                name: folder.name,
                parentToken: 'virtual_shared_files',
                url: folder.url
            });
            await getFileList(token, `共享文件夹/${folder.name}`, fileList, folderList, 'virtual_shared_files');
        }
    } catch (error) {
        console.log('加载共享空间数据时出错:', error);
        analytics.trackError('加载共享空间数据时出错');
    }
    
    // 3. 加载知识库数据 - 放到"我的知识库"下
    console.log('开始加载知识库数据...');
    try {
        const wikiSpaces = await fetchWikiSpaces();
        for (const space of wikiSpaces) {
            const spaceNode: FeishuFolder = {
                path: `我的知识库/${space.space_name}`,
                obj_token: space.root_token,
                name: space.space_name.replace(/\//g, '-'),
                parentToken: 'virtual_knowledge_base',
                url: ''
            };
            folderList.push(spaceNode);
            const childrenInfo = await fetchWikiNodeChildren(space.space_id, space.root_token);
            if (childrenInfo && childrenInfo.data && childrenInfo.data.tree) {
                const { nodes, child_map } = childrenInfo.data.tree;
                const childrenTokens = child_map[space.root_token] || [];
                for (const childToken of childrenTokens) {
                    const childNode = nodes[childToken];
                    if (childNode) {
                        await processWikiNode(childNode, `我的知识库/${space.space_name.replace(/\//g, '-')}`, fileList, folderList, space.space_id, space.root_token);
                    }
                }
            }
        }
    } catch (error) {
        console.log('加载知识库数据时出错:', error);
        analytics.trackError('加载知识库数据时出错');
    }
    
    // 构建树形结构
    const treeData = buildTreeStructure(fileList, folderList);
    
    console.log("load result, fileList", fileList, "folderList", folderList, "treeData", treeData);
    
    // 存储数据
    chrome.storage.local.set({ 
        'lastLoadTime': new Date().getTime(),
        'lastHostName': window.location.hostname,
        'feishuFileList': fileList,
        'feishuFolderList': folderList,
        'feishuTreeData': treeData  // 新增：直接存储树形结构
    });
    analytics.trackPageView('/loadAllFileList/success', '文件列表加载成功');
}

/**
 * @description 获取文件列表
 * @param obj_token 文件夹obj_token
 * @param folder_path 文件夹路径
 * @param fileList 文件列表
 * @param folderList 文件夹列表
 * @param parentToken 父文件夹 obj_token 
 */
async function getFileList(obj_token: string, folder_path: string, fileList: FeishuFile[], folderList: FeishuFolder[], parentToken?: string) {
    try {
        const ret = obj_token ? await fetchChildrenList(obj_token) : await fetchMySpaceFileList();

        for (const nodeId of ret.data.node_list) {
            const node = ret.data.entities.nodes[nodeId];
            
            // 检查节点是否有效
            if (!node || !node.obj_token) {
                console.warn('跳过无效节点:', node);
                continue;
            }
            if(!node.name) {
                node.name = "未命名文件";
            }
            
            if (node.obj_token != obj_token && node.type == 0) {
                await getFileList(node.obj_token, `${folder_path}/${node.name.replace(/\//g, '-')}`, fileList, folderList, node.obj_token);
                let path = `${folder_path}/${node.name.replace(/\//g, '-')}`;
                folderList.push({ path: path, obj_token: node.obj_token, name: node.name.replace(/\//g, '-'), parentToken: obj_token, url: node.url }); 
            } else if (node.obj_token != obj_token && node.type != 0) {
                // 检查URL是否存在
                if (!node.url) {
                    console.warn('跳过没有URL的文件节点:', node);
                    continue;
                }
                
                const file: FeishuFile = {
                    obj_token: node.obj_token, 
                    obj_type: node.type,
                    name: node.name.replace(/\//g, '-'),
                    url: node.url,
                    parentToken: obj_token || parentToken || '',
                    path: folder_path
                };
                fileList.push(file);
            }
        }
    } catch (error) {
        console.error('getFileList error:', error);
    }
}

/**
 * @description 将TreeNode转换为TreeDataNode
 * @param node TreeNode
 * @returns TreeDataNode
 */
function convertTreeNodeToTreeData(node: TreeNode): TreeDataNode {
    try {
        // 检查节点数据的有效性
        if (!node || !node.key || !node.label) {
            console.warn('跳过无效的TreeNode:', node);
            // 返回一个默认的有效节点，避免undefined key
            return {
                title: node?.label || 'Unknown',
                key: node?.key || `fallback_${Date.now()}_${Math.random()}`,
                type: node?.type || 'folder',
                obj_token: node?.obj_token || '',
                path: node?.path || '',
                obj_type: node?.obj_type,
                url: node?.url,
                checkable: true, // 所有节点都可以被选中
                selectable: false,
                children: []
            };
        }
        
        return {
            title: node.label,
            key: node.key,
            type: node.type,
            obj_token: node.obj_token,
            path: node.path,
            obj_type: node.obj_type,
            url: node.url,
            checkable: true, // 所有节点都可以被选中
            selectable: false,
            children: node.children?.map(child => convertTreeNodeToTreeData(child)).filter(child => child.key) // 过滤掉无效的子节点
        };
    } catch (error) {
        console.error('convertTreeNodeToTreeData error:', error);
        return {
            title: 'Error',
            key: `error_${Date.now()}_${Math.random()}`,
            type: 'folder',
            obj_token: '',
            path: '',
            checkable: false,
            selectable: false,
            children: []
        };
    }
}

/**
 * @description 获取树形数据
 * @returns Promise<TreeDataNode[]>
 */
async function getTreeData(): Promise<TreeDataNode[]> {
    try {
        const treeData = await getLocalStorageData('feishuTreeData') as TreeNode[];
        if (treeData && treeData.length > 0) {
            return treeData.map(node => convertTreeNodeToTreeData(node));
        }
        
        // 如果没有树形数据，尝试从文件夹列表构建
        const folderList = await getLocalStorageData('feishuFolderList') as FeishuFolder[];
        if (!folderList || folderList.length === 0) {
            return [];
        }
        
        // 这里可以添加从folderList构建TreeDataNode的逻辑
        return [];
    } catch (error) {
        console.error('getTreeData error:', error);
        return [];
    }
}

/**
 * @description 递归处理知识库节点
 * @param node 知识库节点
 * @param path 当前路径
 * @param fileList 文件列表
 * @param folderList 文件夹列表
 * @param spaceId 知识库ID
 */
async function processWikiNode(node: WikiNode, path: string, fileList: FeishuFile[], folderList: FeishuFolder[], spaceId: string, parentToken?: string) {
    const currentPath = `${path}/${node.title.replace(/\//g, '-')}`;
    if (node.has_child) {
        const folder: FeishuFolder = {
            path: currentPath,
            obj_token: node.obj_token,
            name: node.title.replace(/\//g, '-'),
            parentToken: parentToken,
            url: node.url
        };
        folderList.push(folder);

        const childrenInfo = await fetchWikiNodeChildren(spaceId, node.wiki_token);
        if (childrenInfo && childrenInfo.data && childrenInfo.data.tree) {
            const { nodes, child_map } = childrenInfo.data.tree;
            const childrenTokens = child_map[node.wiki_token] || [];
            for (const childToken of childrenTokens) {
                const childNode = nodes[childToken];
                if (childNode) {
                    await processWikiNode(childNode, currentPath, fileList, folderList, spaceId, node.obj_token);
                }
            }
        }
    } else {
        const file: FeishuFile = {
            obj_token: node.obj_token,
            obj_type: node.obj_type,
            name: node.title.replace(/\//g, '-'),
            url: node.url,
            parentToken: parentToken,
            path: path
        };
        fileList.push(file);
    }
}


export { 
    loadAllFileList, 
    getTreeData
};