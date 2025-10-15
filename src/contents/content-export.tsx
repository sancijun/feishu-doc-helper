import React, { useEffect, useState } from 'react';
import { Button, Tooltip, Modal, Tree, notification, Progress } from 'antd';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faShareFromSquare } from '@fortawesome/free-regular-svg-icons';
import { faRefresh, faFileLines, faFileExcel, faFolder } from '@fortawesome/free-solid-svg-icons';
import type { PlasmoCSConfig } from 'plasmo';
import { getTreeData, loadAllFileList } from '../services/export-service';
import type { TreeDataNode } from '../types/feishu';
import { getFileExtensionByObjType, getFileTypeByObjType } from '../utils/common';
import { createExportTask, download, waitForExportResult } from '../api/feishu-api';
import { getCurrentTimestamp, getLocalStorageData, sleep } from '../utils/common';
import type { FeishuFile } from '../types/feishu';
import JSZip from 'jszip';
import saveAs from 'file-saver';

import '../styles/content-menu.css';
import { analytics } from '../utils/baidu-analytics';

/**
 * Plasmo 内容脚本配置
 */
export const config: PlasmoCSConfig = {
    matches: ["https://*.feishu.cn/drive/*", "https://*.feishu.cn/wiki/*"],
    run_at: "document_idle"
};

/**
 * 获取根容器，用于挂载 React 组件
 * @returns {Promise<HTMLElement>} 返回一个 Promise，解析为挂载点元素
 */
export const getRootContainer = async () => {
    let referenceElement;
    // 尝试多次查找挂载点
    for (let retryCount = 0; retryCount < 50 && !referenceElement; retryCount++) {
        await sleep(500);
        referenceElement = document.querySelector('.new-notice-wrapper') || document.querySelector('.suite-notice-center');
        console.log('getRootContainer: 查找挂载点', referenceElement);
    }
    const menuContainer = document.createElement('div');
    // 将挂载点插入到参考元素之前
    referenceElement.insertAdjacentElement('afterend', menuContainer);
    return menuContainer;
};

/**
 * 导出菜单组件
 * @constructor
 */
const Menu: React.FC = () => {

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [treeData, setTreeData] = useState<TreeDataNode[]>([]);
    const [checkedKeys, setCheckedKeys] = useState<React.Key[]>([]);
    const [selectedKeys, setSelectedKeys] = useState<React.Key[]>([]);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [api, contextHolder] = notification.useNotification();

    /**
     * 导出选定的文档
     * @param {string[]} selectedTokens - 选定的文件 token 列表
     */
    async function onExportDocs(selectedTokens: string[]) {
        console.log('onExportDocs: 开始导出，选定的 tokens:', selectedTokens);
        analytics.trackPageView('/export/start', '开始导出');
        const zip = new JSZip();
        try {
            const fileList = await getLocalStorageData('feishuFileList') as FeishuFile[];
            console.log('onExportDocs: 从缓存获取文件列表', fileList);

            const exportList = fileList.filter((file: FeishuFile) => selectedTokens.includes(file.obj_token));

            console.log(`onExportDocs: 待导出的文件列表，共 ${exportList.length} 个`, exportList);

            api.info({
                key: 'export-progress',
                message: '正在准备导出...',
                description: `共 ${exportList.length} 个文件`,
                duration: 0, // 持续显示，直到手动关闭
            });

            let count = 0;
            const batchSize = 5; // 设置批处理大小为5

            for (let i = 0; i < exportList.length; i += batchSize) {
                const batch = exportList.slice(i, i + batchSize);
                await Promise.all(batch.map(async (file) => {
                    const percent = Math.round(((++count) / exportList.length) * 100);
                    api.info({
                        key: 'export-progress',
                        message: `正在导出 (${count}/${exportList.length})`,
                        description: <>
                            <div>{file.name}</div>
                            <Progress percent={percent} />
                        </>,
                        duration: 0,
                    });

                    try {
                        const taskId = await createExportTask({
                            token: file.obj_token,
                            obj_type: file.obj_type
                        });
                        console.log(`onExportDocs: 创建导出任务成功，文件: ${file.name}, 任务ID: ${taskId}`);

                        if (taskId) {
                            const result = await waitForExportResult(taskId, file.obj_token, file.obj_type);
                            console.log(`onExportDocs: 获取导出结果成功，文件: ${file.name}`, result);

                            if (result && result.url) {
                                const fileContent = await download(result.url, result.type);
                                if (fileContent) {
                                    // 创建文件夹结构
                                    const folderPath = file.path || '';
                                    const fileName = `${file.name}.${result.type}`;
                                    const fullPath = folderPath ? `${folderPath}/${fileName}` : fileName;
                                    zip.file(fullPath, fileContent);
                                    console.log(`onExportDocs: 文件 ${fileName} 已添加到 zip`);
                                }
                            }
                        }
                    } catch (error) {
                        console.error(`onExportDocs: 导出文件 ${file.name} 失败`, error);
                        analytics.trackError(`导出文件失败`);
                        api.error({
                            message: '文件导出失败',
                            description: `导出 ${file.name} 时出错，已跳过。`,
                            duration: 3,
                        });
                    }
                }));
            }

            console.log('onExportDocs: 所有文件处理完成，开始生成 zip 文件');
            const content = await zip.generateAsync({ type: 'blob' });
            saveAs(content, `飞书文档导出-${getCurrentTimestamp()}.zip`);
            console.log('onExportDocs: zip 文件生成并保存成功');
            analytics.trackPageView('/export/success', '导出成功');

            api.success({
                key: 'export-progress',
                message: '导出完成',
                description: `共 ${exportList.length} 个文档已成功导出。`,
                duration: 5,
            });
        } catch (error) {
            console.error('onExportDocs: 导出过程中发生严重错误', error);
            analytics.trackError('导出过程中发生严重错误');
            api.error({
                key: 'export-progress',
                message: '导出失败',
                description: '导出过程中发生错误，请检查控制台日志。'
            });
        }
    }

    /**
     * 显示模态框
     */
    const showModal = async () => {
        console.log('showModal: 尝试显示模态框');
        try {
            // 先尝试从缓存获取数据
            const cachedData = await getTreeData();
            console.log('showModal: 从缓存获取树形数据', cachedData);

            if (cachedData && cachedData.length > 0) {
                // 有缓存数据，先显示
                setTreeData(cachedData);
                setIsModalOpen(true);
                console.log('showModal: 使用缓存数据，并打开模态框');

                // 后台异步检查是否需要更新数据
                checkAndUpdateData();
            } else {
                // 没有缓存数据，提示用户开始加载
                console.log('showModal: 没有缓存数据，开始加载');
                api['info']({
                    key: 'loading notification',
                    message: '文档批量导出',
                    description: '没有缓存数据，正在加载文件列表，请稍候...',
                    duration: null,
                });

                // 开始加载数据
                await loadDataAndShowModal();
            }
        } catch (error) {
            console.error('showModal: 获取树形数据失败', error);
            analytics.trackError('获取树形数据失败');
            api['error']({
                key: 'loading notification',
                message: '文档批量导出',
                description: '数据加载失败，请稍后重试或点击刷新按钮重新加载',
                duration: 5,
            });
        }
    };

    /**
     * 检查并更新数据
     */
    const checkAndUpdateData = async () => {
        console.log('checkAndUpdateData: 开始检查数据是否需要更新');
        try {
            // 检查数据是否需要更新（这里可以根据时间戳等判断）
            const lastLoadTime = await getLocalStorageData('lastLoadTime') as number;
            const now = Date.now();
            const oneHour = 60 * 60 * 1000; // 1小时

            if (!lastLoadTime || (now - lastLoadTime) > oneHour) {
                console.log('checkAndUpdateData: 数据已过期，开始后台更新');
                // 数据过期，后台更新
                api['info']({
                    key: 'background-update',
                    message: '数据更新',
                    description: '正在后台更新文件列表...',
                    duration: 3,
                });

                await loadAllFileList();
                const newData = await getTreeData();
                if (newData && newData.length > 0) {
                    setTreeData(newData);
                    console.log('checkAndUpdateData: 后台数据更新成功');
                    api['success']({
                        key: 'background-update',
                        message: '数据更新',
                        description: '文件列表已更新！',
                        duration: 2,
                    });
                }
            } else {
                console.log('checkAndUpdateData: 数据未过期，无需更新');
            }
        } catch (error) {
            console.error('checkAndUpdateData: 后台更新数据失败', error);
            analytics.trackError('后台更新数据失败');
            // 静默失败，不影响用户体验
        }
    };

    /**
     * 加载数据并显示模态框
     */
    const loadDataAndShowModal = async () => {
        console.log('loadDataAndShowModal: 开始加载数据');
        setIsLoading(true);
        try {
            await loadAllFileList();
            const data = await getTreeData();
            console.log('loadDataAndShowModal: 获取树形数据成功', data);

            if (data && data.length > 0) {
                setTreeData(data);
                setIsModalOpen(true);
                api['success']({
                    key: 'loading notification',
                    message: '文档批量导出',
                    description: '文件列表加载完成！',
                    duration: 2,
                });
            } else {
                api['warning']({
                    key: 'loading notification',
                    message: '文档批量导出',
                    description: '未找到可导出的文件，请检查您的权限或稍后重试',
                    duration: 5,
                });
            }
        } catch (error) {
            console.error('loadDataAndShowModal: 加载数据失败', error);
            analytics.trackError('加载数据失败');
            api['error']({
                key: 'loading notification',
                message: '文档批量导出',
                description: '数据加载失败，请稍后重试',
                duration: 5,
            });
        } finally {
            setIsLoading(false);
            console.log('loadDataAndShowModal: 加载过程结束');
        }
    };

    /**
     * 模态框确认按钮点击事件处理
     */
    const handleOk = () => {
        setIsModalOpen(false);
        console.log('handleOk: 确认导出，选中的 keys:', checkedKeys);
        if (!checkedKeys.length) {
            console.log('handleOk: 未选择任何文件，操作取消');
            return;
        }

        onExportDocs(checkedKeys.map(key => key.toString()));
    };

    /**
     * 模态框取消按钮点击事件处理
     */
    const handleCancel = () => {
        console.log('handleCancel: 取消导出');
        setIsModalOpen(false);
        setCheckedKeys([]);
    };

    /**
     * 刷新文件列表
     */
    const handleRefresh = async () => {
        console.log('handleRefresh: 开始刷新文件列表');
        setIsRefreshing(true);
        try {
            // 清除缓存，强制重新加载
            await new Promise<void>(resolve => chrome.storage.local.remove(['lastLoadTime', 'feishuFileList', 'feishuFolderList', 'feishuTreeData'], () => resolve()));
            console.log('handleRefresh: 已清除本地缓存');

            api['info']({
                key: 'refresh notification',
                message: '刷新文件列表',
                description: '正在重新加载文件列表，请稍候...',
                duration: null,
            });

            // 重新加载文件列表
            await loadAllFileList();
            console.log('handleRefresh: 文件列表重新加载完成');

            // 重新获取树形数据
            const data = await getTreeData();
            setTreeData(data);
            console.log('handleRefresh: 树形数据重新生成完成');

            api['success']({
                key: 'refresh notification',
                message: '刷新文件列表',
                description: '文件列表刷新完成！',
                duration: 3,
            });
        } catch (error) {
            console.error('handleRefresh: 刷新文件列表失败', error);
            analytics.trackError('刷新文件列表失败');
            api['error']({
                key: 'refresh notification',
                message: '刷新文件列表',
                description: '刷新失败，请稍后重试',
                duration: 3,
            });
        } finally {
            setIsRefreshing(false);
            console.log('handleRefresh: 刷新过程结束');
        }
    };

    /**
     * Tree 组件 check 事件处理
     * @param checkedKeysValue
     */
    const onCheck = (checkedKeysValue: any) => {
        console.log('onCheck: 选中项变化', checkedKeysValue);
        setCheckedKeys(checkedKeysValue);
    };

    /**
     * Tree 组件 select 事件处理
     * @param selectedKeysValue
     */
    const onSelect = (selectedKeysValue: React.Key[]) => {
        console.log('onSelect: 选中项变化', selectedKeysValue);
        setSelectedKeys(selectedKeysValue);
    };

    return (
        <>
            {contextHolder}
            <Tooltip placement="bottom" title='批量导出'>
                <Button 
                    type="text" 
                    onClick={showModal} 
                    icon={<FontAwesomeIcon icon={faShareFromSquare} />} 
                    style={{ 
                        marginLeft: '8px', 
                        color: 'var(--icon-n2)',
                        height: '28px',
                        width: '28px'
                    }} 
                    loading={isLoading}
                    disabled={isLoading}
                />
            </Tooltip>
            <Modal 
                title={
                    <div style={{ display: 'flex' }}>
                        <span style={{ fontSize: '16px', fontWeight: '600' }}>选择要导出的文件</span>
                        <Tooltip title="刷新文件列表">
                            <Button 
                                type="text" 
                                icon={<FontAwesomeIcon icon={faRefresh} />}
                                onClick={handleRefresh}
                                loading={isRefreshing}
                                style={{ color: 'var(--icon-n2)'}}
                            />
                        </Tooltip>
                    </div>
                }
                open={isModalOpen} 
                onOk={handleOk} 
                okText='确认' 
                onCancel={handleCancel} 
                cancelText='取消'
                width={600}
                style={{ top: 20 }}
            >
                <div style={{ maxHeight: '400px', overflow: 'auto', marginTop: '15px', marginBottom: '15px' }}>
                    <Tree
                        checkable
                        onCheck={onCheck}
                        checkedKeys={checkedKeys}
                        onSelect={onSelect}
                        selectedKeys={selectedKeys}
                        treeData={treeData}
                        showIcon={false}
                        defaultExpandAll={false}
                        height={350}
                        itemHeight={28}
                        blockNode={true}
                        titleRender={(node: any) => {
                            let icon;
                            if (node.type === 'folder') {
                                icon = faFolder;
                            } else {
                                const fileType = getFileExtensionByObjType(node.obj_type);
                                if (fileType === 'docx') {
                                    icon = faFileLines;
                                } else if (fileType === 'xlsx') {
                                    icon = faFileExcel;
                                }
                            }
                            return (
                                <div style={{ display: 'flex', alignItems: 'center' }}>
                                    {icon && <FontAwesomeIcon icon={icon} style={{ marginRight: 8, color: 'var(--icon-n2)' }} />}
                                    <span>{node.title}</span>
                                </div>
                            );
                        }}
                    />
                </div>
            </Modal>

        </>
    )
}

export default Menu;
