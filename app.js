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
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true, parameterLimit: 1000000 }));
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
let borwserMaps = []
// 初始化
const _init = async () => {
    for (const borwser of data){
        const api = new ChatGPTAPIBrowser({
            ...borwser
        })
        await api.initSession()

        borwserMaps[borwser.id] = {
            api,
            serverStatus : true
        }
    }
}
_init()

app.all('*', function (req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    res.header("Access-Control-Allow-Methods", "PUT,POST,GET,DELETE,OPTIONS");
    res.header("Content-Type", "application/json;charset=utf-8");
    next();
})
app.post("/chatgpt", async (req, res) => {
    const server = req?.body?.server
    const conversationId = req?.body?.conversation_id
    const parentMessageId = req?.body?.parent_message_id
    const subject = req?.body?.subject
    if(!subject){
        return res.json({ code: 1, msg: 'subject error' })
    }
    
    
    // 获取使用哪一个账号进行访问
    const allBrowserKeys = Object.keys(borwserMaps)
    const tmp = Math.floor(Math.random() * allBrowserKeys.length);
    const borwserId = allBrowserKeys[tmp]
    const borwser = borwserMaps[server ?? borwserId]
    if(!borwser?.serverStatus) {
        return res.json({ code: 1, msg: 'system loading' })
    }
    try {
        if (!(await borwser.api.getIsAuthenticated())) {
            borwser.serverStatus = false
        }
        let response = await borwser.api.sendMessage(subject, {
            conversationId,
            parentMessageId
        })
        borwser.serverStatus = true
        return res.json({ code: 0, msg:'success' , data: {
            content : response.response,
            conversation_id: response.conversationId,
            parent_message_id : response.messageId,
            server: borwserId
        }})
    }catch(err) {
        console.log(err)
        if(err.statusCode === 401){
            delete borwserMaps[borwserId]
        }
        logger.error("borwserId:" + borwserId)
        logger.error("ERROR:" + err.toString())
        return res.json({ code: 1, msg: err.message })
    }
})

app.listen(process.env.APP_PORT, process.env.APP_HOST_NAME, function () {
    console.log(`服务器运行在http://${process.env.APP_HOST_NAME}:${process.env.APP_PORT}`);
})