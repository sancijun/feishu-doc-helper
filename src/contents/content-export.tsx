import React, { useEffect, useState } from 'react';
import { Button, Tooltip, Modal, Cascader, notification } from 'antd';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faShareFromSquare } from '@fortawesome/free-regular-svg-icons';
import type { PlasmoCSConfig } from 'plasmo';
import { cascaderData, createExportTask, download, getCurrentTimestamp, getLocalStorageData, loadAllFileList, sleep, waitForExportResult } from './content-core';
import JSZip from 'jszip';
import saveAs from 'file-saver';

import './content-menu.css';

export const config: PlasmoCSConfig = {
    matches: ["https://*.feishu.cn/drive/*"],
    run_at: "document_idle"
};

export const getRootContainer = async () => {
    let container;
    for (let retryCount = 0; retryCount < 20 && !container; retryCount++) {
        await sleep(500)
        container = document.querySelector('.sc-hKwCoD.fgBDdK');
        console.log('root', container);
    }
    const menuContainer = document.createElement('div');
    container.prepend(menuContainer);
    return menuContainer;
};

const Menu: React.FC = () => {

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [cascaderOptions, setCascaderOptions] = useState();
    const [selectedValue, setSelectedValue] = useState(['全部导出']);
    const [api, contextHolder] = notification.useNotification();

    useEffect(() => {
        loadAllFileList();
    }, []);

    async function onExportDocs(folderList: []) {
        const zip = new JSZip()
        const fileList = await getLocalStorageData('feishuFileList') as [];
        const exportList = folderList.includes('全部导出') ? fileList : fileList.filter(file => folderList.some(folder => file.folder_path.includes(folder)));
        console.log("export list:", exportList.length, exportList);

        let count = 0;
        for (const file of exportList) {
            const curProgress = `${count++}/${exportList.length}`;
            api['info']({
                key: 'export progress notification',
                message: '文档批量导出',
                description: (
                    <span>
                        文档导出中，导出速度取决于导出文档数量，当前进度 <span style={{ color: 'blue' }}>{curProgress}</span>， 导出完成前请勿关闭或刷新本页面。
                    </span>
                ),
            });
            await sleep(500);
            let file_extension = file.obj_type == 'sheet' || file.obj_type == 'bitable' ? 'xlsx' : 'docx'
            const resp = await createExportTask({
                "token": file.obj_token,
                "type": file.obj_type,
                "file_extension": file_extension,
                "event_source": 1,
                "need_comment": false
            }, file.url, file.type);

            const ticket = resp?.data?.ticket
            if (!ticket) {
                console.log("file export ticket error:", file, resp)
                continue;
            }
            const file_token = await waitForExportResult(resp.data.ticket, file.obj_token, file.obj_type, file.type);
            if (!file_token) {
                console.log("file export file_token error:", file_token)
                continue;
            }
            const fileStream = await download(file_token, file.obj_token, file.type);
            const buffer = await fileStream.arrayBuffer();
            const uint8Array = new Uint8Array(buffer);
            var folder = zip;
            for (const part of file.folder_path.split("/")) {
                folder = folder.folder(part);
            }
            folder.file(`${file.name || file.obj_token}.${file_extension}`, uint8Array)

        }
        const f = await zip.generateAsync({ type: 'blob' });
        saveAs(f, `feishu-export-${getCurrentTimestamp()}.zip`);
        api['success']({
            key: 'export progress notification',
            message: '文档批量导出',
            description: `文档批量导出完成，共导出 ${exportList.length} 篇文档。`,
        });
    }

    const showModal = async () => {
        const lastFolderList = await getLocalStorageData('feishuFolderList') as [];
        setCascaderOptions(cascaderData(lastFolderList));
        setIsModalOpen(true);
    };

    const handleOk = () => {
        setIsModalOpen(false);
        const selectFolders = selectedValue.map((item) => item[item.length - 1]) || [];
        onExportDocs(selectFolders);
        api['info']({
            key: 'export progress notification',
            message: '文档批量导出',
            description: `文档批量导出中，导出速度取决于导出文档数量， 导出完成前请勿关闭或刷新本页面。`,
        });
    };

    const handleCancel = () => {
        setIsModalOpen(false);
    };

    const handleCascaderChange = (value, selectedOptions) => {
        console.log(value, selectedOptions);
        setSelectedValue(value);
    };

    return (
        <>
            {contextHolder}
            <Tooltip placement="bottom" title='批量导出'>
                <Button type="text" onClick={showModal} icon={<FontAwesomeIcon icon={faShareFromSquare} />} style={{ marginLeft: '10px' }} />
            </Tooltip>
            <Modal title="选择你要导出的目录" open={isModalOpen} onOk={handleOk} okText='确认' onCancel={handleCancel} cancelText='取消'>
                <Cascader options={cascaderOptions} multiple onChange={handleCascaderChange} placeholder="选择你要导出的目录……" value={selectedValue} style={{ width: '100%', marginTop: '15px', marginBottom: '15px' }} />
            </Modal>
        </>
    )
}

export default Menu;
