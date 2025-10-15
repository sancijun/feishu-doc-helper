import React from 'react';

/**
 * @description 飞书文件
 */
export interface FeishuFile {
    /**
     * @description 文件 obj_token
     */
    obj_token: string;
    /**
     * @description 文件 obj_type
     */
    obj_type: number;

    /**
     * @description 文件名
     */
    name: string;
    /**
     * @description 文件链接
     */
    url: string;
    /**
     * @description 父文件夹token
     */
    parentToken: string;
    /**
     * @description 文件路径
     */
    path: string;
    /**
     * @description 创建时间
     */
    createTime?: number;
    /**
     * @description 修改时间
     */
    modifyTime?: number;
}

/**
 * @description 飞书文件夹
 */
export interface FeishuFolder {
    /**
     * @description 文件夹 obj_token
     */
    obj_token: string;
    /**
     * @description 文件夹名
     */
    name: string;
    /**
     * @description 文件夹路径
     */
    path: string;
    /**
     * @description 文件夹链接
     */
    url: string;
    /**
     * @description 父文件夹token
     */
    parentToken?: string;
    /**
     * @description 子文件/文件夹
     */
    children?: string[];
}

/**
 * @description 知识库空间
 */
export interface WikiSpace {
    /**
     * @description 知识库ID
     */
    space_id: string;
    /**
     * @description 知识库名称
     */
    space_name: string;
    /**
     * @description 知识库描述
     */
    description: string;
    /**
     * @description 知识库根节点token
     */
    root_token: string;
    /**
     * @description 知识库类型
     */
    space_type: number;
    /**
     * @description 知识库可见性
     */
    wiki_scope: number;
}

/**
 * @description 知识库节点
 */
export interface WikiNode {
    /**
     * @description 知识库ID
     */
    space_id: string;
    /**
     * @description 父节点wiki_token
     */
    parent_wiki_token: string;
    /**
     * @description 节点wiki_token
     */
    wiki_token: string;
    /**
     * @description 节点obj_token
     */
    obj_token: string;
    /**
     * @description 节点类型
     */
    obj_type: number;
    /**
     * @description 节点标题
     */
    title: string;
    /**
     * @description 排序ID
     */
    sort_id: number;
    /**
     * @description 节点类型
     */
    wiki_node_type: number;
    /**
     * @description 是否有子节点
     */
    has_child: boolean;
    /**
     * @description 节点链接
     */
    url: string;
}

/**
 * @description 知识库树形结构响应
 */
export interface WikiTreeResponse {
    code: number;
    msg: string;
    data: {
        tree: {
            root_list: string[];
            child_map: { [key: string]: string[] };
            nodes: { [key: string]: WikiNode };
        };
    };
}

/**
 * @description 树形组件节点
 */
export interface TreeDataNode {
    title: string;
    key: string;
    icon?: React.ReactNode;
    children?: TreeDataNode[];
    // 扩展属性
    type: 'folder' | 'file';
    obj_token: string;  
    path: string;
    obj_type?: number;
    url?: string;
    checkable?: boolean;
    selectable?: boolean;
}

/**
 * @description 树形节点
 */
export interface TreeNode {
    key: string;
    value: string;
    label: string;
    type: 'folder' | 'file';
    children?: TreeNode[];
    // 原始数据
    obj_token: string;  
    path: string;
    obj_type?: number;
    // 文件特有属性
    url?: string;
}

/**
 * @description 飞书API响应
 */
export interface FeishuApiResponse {
    code: number;
    msg: string;
    data: any;
}

/**
 * @description 导出任务响应
 */
export interface ExportTaskResponse {
    code: number;
    data: {
        ticket: string;
    };
}

/**
 * @description 导出结果响应
 */
export interface ExportResultResponse {
    code: number;
    data: {
        result: {
            file_token: string;
        };
    };
}