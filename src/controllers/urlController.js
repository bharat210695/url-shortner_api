const UrlModel = require('../models/urlModel')
const validUrl = require('valid-url')
const shortid = require('shortid')
const redis = require("redis");
const { promisify } = require("util");

const isValid = function(value) {
    if (typeof value === 'undefined' || value === null) return false
    if (typeof value === 'string' && value.trim().length === 0) return false
    if (typeof value === 'number' && value.toString().trim().length === 0) return false
    return true;
}


// redis connection====================================================================//
const redisClient = redis.createClient(
    17945,
    "redis-17945.c56.east-us.azure.cloud.redislabs.com", { no_ready_check: true } // redis endpoint
);
redisClient.auth("LwwsL9T8kY8LMA2XARPJgoZIBEUbJg5M", function(err) { // redis password
    if (err) throw err;
});
redisClient.on("connect", async function() {
    console.log("Connected to Redis..");
});

const SET_ASYNC = promisify(redisClient.SET).bind(redisClient);
const GET_ASYNC = promisify(redisClient.GET).bind(redisClient);


// create a short URL====================================//
const createUrl = async function(req, res) {
    try {
        let data = req.body
        let { longUrl } = data

        if (Object.keys(data).length = 0) {
            return res.status(400).send({ status: false, message: "request body is empty, BAD request" })
        }
        if (!isValid(longUrl)) {
            return res.status(400).send({ status: false, message: "longUrl is required in body" })
        }
        if (!validUrl.isUri(longUrl)) {
            return res.status(400).send({ status: false, msg: "longUrl is not a valid url" })
        }

        if (!(/(http(s)?:\/\/.)?(www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_\+.~#?&//=]*)/g.test(longUrl))) {
            return res.status(400).send({ status: false, message: "longUrl is not a valid URL" })
        }

        let urlCode = shortid.generate()
        let urlAlreadyUsed = await UrlModel.findOne({ longUrl })
        if (urlAlreadyUsed) {
            //return res.status(400).send({ status: false, message: "url already used" })
            res.json(urlAlreadyUsed)
        } else {

            let baseUrl = 'http://localhost:3000'
            let shortUrl = baseUrl + '/' + urlCode

            let urlCreated = { urlCode: urlCode, longUrl, shortUrl: shortUrl }
            let newUrl = await UrlModel.create(urlCreated)
            await SET_ASYNC(`${urlCode}`, JSON.stringify(newUrl))
            return res.status(201).send({ status: true, message: "url created successfully", data: newUrl })
        }
    } catch (error) {
        console.log(error)
        res.status(500).send({ status: false, error: error.message })
    }
}



// get url code=============================================//
const getUrlCode = async function(req, res) {
    try {
        let urlCode = req.params.urlCode
        if (!isValid(urlCode)) {
            return res.status(400).send({ status: false, message: "urlCode is required" })
        }
        let cahceUrlData = await GET_ASYNC(`${urlCode}`)
        if (cahceUrlData) {
            return res.status(302).redirect(JSON.parse(cahceUrlData))
        } else {
            let url = await UrlModel.findOne({ urlCode: urlCode })
            if (!url) {
                return res.status(404).send({ status: false, message: "urlCode not exist" })
            }
            await SET_ASYNC(`${urlCode}`, JSON.stringify(url.longUrl)), "EX", 100
            return res.status(302).redirect(url.longUrl)
        }

    } catch (error) {
        console.log(error)
        res.status(500).send({ status: false, error: error.message })
    }
}




module.exports.createUrl = createUrl
module.exports.getUrlCode = getUrlCode