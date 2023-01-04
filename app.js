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
    datePattern: 'YYYY-MM-DD',
    zippedArchive: false,
    maxSize: '20m',
    maxFiles: '7d'
});
const logger = winston.createLogger({
    transports: [
        transport
    ]
})
let borwserMaps = [], intervalMaps = [], chooseMaps = [], expMaps = []
// 初始化
const _init = async (borwserId = null) => {
    for (const borwser of data){
        if(borwserId !== null && borwserId != borwser.id){
            continue
        }
        const api = new ChatGPTAPIBrowser({
            ...borwser
        })
        await api.initSession()

        borwserMaps[borwser.id] = {
            api,
            serverStatus : true
        }
        intervalMaps[borwser.id] = {
            interval: setInterval( async()=>{
                if(borwserMaps.indexOf(borwser.id) !== -1){
                    borwserMaps[borwser.id].serverStatus = false
                    await borwserMaps[borwser.id].refreshSession()
                    borwserMaps[borwser.id].serverStatus = true
                }
            }, 60 * 60 * 1000)
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
    expMaps.forEach((item, key) =>{
        if(item.exp <= new Date().getTime()){
            borwserMaps[item.id] =item.borwser
            delete expMaps[key]
        }
    })

    // 获取使用哪一个账号进行访问
    let allBrowserKeys = Object.keys(borwserMaps)
    if(allBrowserKeys.length < 1){
        borwserMaps = chooseMaps
        chooseMaps = []
        allBrowserKeys = Object.keys(borwserMaps)
    }
    if (allBrowserKeys.length === 0){
        return res.json({ code: 1, msg: '所有账号请求都已经限量,请等1个时候后重试' })
    }
    // console.log(allBrowserKeys.length)
    // console.log('chooseMaps', Object.keys(chooseMaps))
    // const tmp = Math.floor(Math.random() * allBrowserKeys.length);
    const borwserId = allBrowserKeys[0]
    const borwser = borwserMaps[server ?? borwserId] ?? chooseMaps[server]
    if(!borwser?.serverStatus) {
        return res.json({ code: 1, msg: '帐号加载中...请稍后' })
    }
    // if (!(await borwser.api.getIsAuthenticated())) {
    //     return res.json({ code: 1, msg: '帐号加载中...请稍后' })
    // }
    try {
        if(!server && chooseMaps.indexOf(borwserId) === -1){
            chooseMaps[borwserId] = borwser
            delete borwserMaps[borwserId]
        }
        
        let response = await borwser.api.sendMessage(subject, {
            conversationId,
            parentMessageId,
            timeoutMs: 3 * 60 * 1000
        })
        // borwser.serverStatus = true
        
        

        return res.json({ code: 0, msg:'success' , data: {
            content : response.response,
            conversation_id: response.conversationId,
            parent_message_id : response.messageId,
            server: server ?? borwserId
        }})
    }catch(err) {
        console.log(err)
        logger.error("ERROR_TIME:"+getCurrentTime())
        logger.error("BORWSER_ID:" + borwserId)
        logger.error("ERROR:" + err.toString())
        logger.error("--------------------------------")
        if(err.statusCode === 401){
            console.log(borwserId)
            // await borwserMaps[borwserId].initSession() // 重新登录
            // delete borwserMaps[borwserId]
        }else if(err.statusCode === 403) {
            await borwserMaps[borwserId].refreshSession() // 强制刷新session 
            return res.json({ code: 1, msg: '服务繁忙,请稍后再试' })
        }else if(err.statusCode === 429){
            expMaps.push({ id: server ?? borwserId, borwser:borwser, exp: new Date().getTime() + (30 * 60 * 1000)})
            delete borwserMaps[server ?? borwserId]
            return res.json({ code: 1, msg: '该服务账号被屏蔽,请1小时后重试该账号' })
        }
        return res.json({ code: 1, msg: "服务繁忙,请重试" })
    }
})

app.listen(process.env.APP_PORT, process.env.APP_HOST_NAME, function () {
    console.log(`服务器运行在http://${process.env.APP_HOST_NAME}:${process.env.APP_PORT}`);
})

function getCurrentTime() {
    var date = new Date();//当前时间
    var month = zeroFill(date.getMonth() + 1);//月
    var day = zeroFill(date.getDate());//日
    var hour = zeroFill(date.getHours());//时
    var minute = zeroFill(date.getMinutes());//分
    var second = zeroFill(date.getSeconds());//秒
    
    //当前时间
    var curTime = date.getFullYear() + "-" + month + "-" + day
            + " " + hour + ":" + minute + ":" + second;
    
    return curTime;
}

/**
 * 补零
 */
function zeroFill(i){
    if (i >= 0 && i <= 9) {
        return "0" + i;
    } else {
        return i;
    }
}