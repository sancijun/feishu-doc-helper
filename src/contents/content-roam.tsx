import React, { useEffect } from 'react';
import { Button, Tooltip } from 'antd';
import Icon from '@ant-design/icons';
import type { CustomIconComponentProps } from '@ant-design/icons/lib/components/Icon';
import type { PlasmoCSConfig } from 'plasmo';
import * as contentUtils from './content-core';
import './content-menu.css';
import { sleep } from './content-core';

export const config: PlasmoCSConfig = {
    matches: ["https://*.feishu.cn/*"],
    run_at: "document_start"
};

export const getRootContainer = async () => {
    let referenceElement;
    for (let retryCount = 0; retryCount < 20 && !referenceElement; retryCount++) {
        await sleep(500)
        referenceElement = document.querySelector('.new-notice-wrapper') || document.querySelector('.suite-notice-center');
        console.log('root', referenceElement);
    }
    const menuContainer = document.createElement('div');
    referenceElement.insertAdjacentElement('beforebegin', menuContainer);
    return menuContainer;
};

const RoamSvg = () => (
    <svg viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="1462" width="200" height="200"><path d="M172.18370333 172.18370333v679.63259334h679.63259334V172.18370333H172.18370333zM75.09333333 172.18370333a97.09036999 97.09036999 0 0 1 97.09037-97.09037h679.63259334a97.09036999 97.09036999 0 0 1 97.09037 97.09037v679.63259334a97.09036999 97.09036999 0 0 1-97.09037 97.09037H172.18370333a97.09036999 97.09036999 0 0 1-97.09037-97.09037V172.18370333z m606.81481444 582.54222222a72.81777778 72.81777778 0 1 0 0-145.63555556 72.81777778 72.81777778 0 0 0 0 145.63555556zM414.90963001 342.09185223a72.81777778 72.81777778 0 1 1-145.63555556 0 72.81777778 72.81777778 0 0 1 145.63555556 0z m97.09036999 242.72592555a72.81777778 72.81777778 0 1 0 0-145.63555556 72.81777778 72.81777778 0 0 0 0 145.63555556z" fill="#646a73" p-id="1463"></path></svg>
);

const RoamIcon = (props: Partial<CustomIconComponentProps>) => (
    <Icon component={RoamSvg} {...props} />
);

const Roam: React.FC = () => {

    useEffect(() => {

    }, []);

    async function onRoamAround() {
        const fileList = await contentUtils.getLocalStorageData('feishuFileList') as [];
        const roamExcludeFolder = await contentUtils.getLocalStorageData('roamExcludeFolder') || [];
        const roamExcludeFolderList = roamExcludeFolder.map((item) => item[item.length - 1]);
        let filteredFileList = fileList.filter(file => {
            return !roamExcludeFolderList.some(excludeFolder => file.folder_path.includes(excludeFolder));
        });
        const randomIndex = Math.floor(Math.random() * filteredFileList.length);
        const randomFile = filteredFileList[randomIndex];

        if (randomFile && randomFile.url) {
            window.open(randomFile.url, '_self');
        } else {
            console.error('无法获取随机文件的链接');
        }
    }

    return (
        <Tooltip placement="bottom" title='文档漫游'>
            <Button type="text" onClick={() => onRoamAround()} icon={<RoamIcon />} style={{ marginLeft: '10px' }} />
        </Tooltip>
    )
}

export default Roam;
