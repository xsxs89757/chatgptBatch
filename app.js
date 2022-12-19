"use strict"
import dotenv from "dotenv"
import express from "express"
import bodyParser from "body-parser";
import * as winston from "winston";
import 'winston-daily-rotate-file';
import { createRequire } from 'module'
import { ChatGPTAPIBrowser } from 'chatgpt'

const require = createRequire(import.meta.url)
const data = require('./.accountList.json')

dotenv.config()
const app = express()
app.use(bodyParser.json({ limit: '50mb' }))
// 日志
const transport = new winston.transports.DailyRotateFile({
    filename: './logs/application-%DATE%.log',
    datePattern: 'YYYY-MM-DD-HH',
    zippedArchive: true,
    maxSize: '20m',
    maxFiles: '7d'
});
const logger = winston.createLogger({
    transports: [
        transport
    ]
})
let borwserMaps = [],
    borwserErrorMaps = [],
    serverStatus = false
// 初始化
const _init = async () => {
    for (const borwser of data){
        let api = new ChatGPTAPIBrowser({
            ...borwser
        })
        await api.initSession()
        borwserMaps[borwser.id] = api
        borwserErrorMaps[borwser.id] = 0
    }
    serverStatus = true
}
_init()


app.post("/chatgpt", async (req, res) => {
    const server = req?.body?.server
    const conversationId = req?.body?.conversationId
    const parentMessageId = req?.body?.parentMessageId
    
    if(!serverStatus) {
        return res.json({ code: 1, msg: 'system loading' })
    }
    // 获取使用哪一个账号进行访问

    try {
    
    }catch(e) {
        
    }
})

app.listen(process.env.APP_PORT, process.env.APP_HOST_NAME, function () {
    console.log(`服务器运行在http://${process.env.APP_HOST_NAME}:${process.env.APP_PORT}`);
})