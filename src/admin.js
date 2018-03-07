'use strict';

var url = require('url');
var _ = require('lodash');
var createId = require('uuid').v4;
var userAgent = require('superagent');
var assert = require('./assert').assert;
var Response = require('./response').Response;
var ResponseError = require('./error').ResponseError;


function isURL(str) {
  var pattern = new RegExp('^(https?:\\/\\/)?'+ // protocol
  '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.?)+[a-z]{2,}|'+ // domain name
  '((\\d{1,3}\\.){3}\\d{1,3}))'+ // OR ip (v4) address
  '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*'+ // port and path
  '(\\?[;&a-z\\d%_.~+=-]*)?'+ // query string
  '(\\#[-a-z\\d_]*)?$','i'); // fragment locator
  return pattern.test(str);
}


/**
 * @class
 */
class Admin {

    constructor(options) {
        assert.property(options, 'url', 'Missing option url');
        assert(isURL(options.url), 'Invalid url', options.url);
        assert.property(options, 'secret');
        this.url = url.parse(options.url);
        this.secret = options.secret;
        this.userAgent = options.userAgent || userAgent;
    }

    makeUrl(path) {
        return this.url.format() + path.replace(/^\//g, '');
    }

    request(req, options) {
        return new Promise((resolve, reject)=>{
            var path = _.get(options, 'path', '/admin');
            req.admin_secret = this.secret;
            req.transaction = createId();
            // logger.debug('Request', req);
            this.userAgent.post(this.makeUrl(path)).type('json').send(req).end((err, res)=>{
                if(_.isObject(err)) {
                    return reject(err);
                }
                // logger.debug('Response', res.body);
                var response = new Response(req, res.body);
                if(response.isSuccess()) {
                    resolve(response);
                } else {
                    reject(new ResponseError(response));
                }
            });
        });
    }

    listSessions() {
        return new Promise((resolve, reject)=>{
            this.request({
                janus: 'list_sessions'
            }).then((res)=>{
                resolve({
                    sessions: _.get(res.getResponse(), 'sessions', []),
                    response: res
                });
            }).catch((err)=>{
                reject(err);
            });
        });
    }

    listHandles(sessionId) {
        return new Promise((resolve, reject)=>{
            assert.isString(sessionId);
            this.request({
                janus: 'list_handles'
            }, {
                path: '/admin/' + sessionId
            }).then((res)=>{
                resolve({
                    handles: _.get(res.getResponse(), 'handles', []),
                    response: res
                });
            }).catch((err)=>{
                reject(err);
            });
        });
    }

    handleInfo(sessionId, handleId) {
        return new Promise((resolve, reject)=>{
            assert.isString(sessionId);
            assert.isString(handleId);
            this.request({
                janus: 'handle_info'
            }, {
                path: '/admin/' + sessionId + '/' + handleId
            }).then((res)=>{
                resolve({
                    info: _.get(res.getResponse(), 'info', {}),
                    response: res
                });
            }).catch((err)=>{
                reject(err);
            });
        });
    }

    setLogLevel(level) {
        return new Promise((resolve, reject)=>{
            assert.isNumber(level);
            assert(_.inRange(level, 0, 8), 'Invalid log level');
            this.request({
                janus: 'set_log_level',
                level: level
            }).then((res)=>{
                resolve({
                    level: res.getResponse().level,
                    response: res
                });
            }).catch((err)=>{
                reject(err);
            });
        });
    }

    setLockingDebug(debug) {
        return new Promise((resolve, reject)=>{
            assert.isNumber(debug);
            this.request({
                janus: 'set_locking_debug',
                debug: debug
            }).then((res)=>{
                resolve({
                    debug: res.getResponse().debug,
                    response: res
                });
            }).catch((err)=>{
                reject(err);
            });
        });
    }

    addToken(token, plugins) {
        return new Promise((resolve, reject)=>{
            assert.isString(token);
            var request = {
                janus: 'add_token',
                token: token
            };

            if(_.isArray(plugins)) {
                request.plugins = plugins;
            }

            this.request(request).then((res)=>{
                resolve({
                    plugins: res.getResponse().data.plugins,
                    response: res
                });
            }).catch((err)=>{
                reject(err);
            });
        });
    }

    allowToken(token, plugins) {
        return new Promise((resolve, reject)=>{
            assert.isString(token);
            assert.isArray(plugins);
            assert(plugins.length > 0, 'Need at least one plugin to allow');
            this.request({
                janus: 'allow_token',
                token: token,
                plugins: plugins
            }).then((res)=>{
                resolve({
                    plugins: res.getResponse().data.plugins,
                    response: res
                });
            }).catch((err)=>{
                reject(err);
            });
        });
    }

    disallowToken(token, plugins) {
        return new Promise((resolve, reject)=>{
            assert.isString(token);
            assert.isArray(plugins);
            assert(plugins.length > 0, 'Need at least one plugin to disallow');
            this.request({
                janus: 'disallow_token',
                token: token,
                plugins: plugins
            }).then((res)=>{
                resolve({
                    plugins: res.getResponse().data.plugins,
                    response: res
                });
            }).catch((err)=>{
                reject(err);
            });
        });
    }

    listTokens() {
        return new Promise((resolve, reject)=>{
            this.request({
                janus: 'list_tokens'
            }).then((res)=>{
                resolve({
                    tokens: res.getResponse().data.tokens,
                    response: res
                });
            }).catch((err)=>{
                reject(err);
            });
        });
    }

    removeToken(token) {
        return new Promise((resolve, reject)=>{
            this.request({
                janus: 'remove_token',
                token: token
            }).then((res)=>{
                resolve({
                    response: res
                });
            }).catch((err)=>{
                reject(err);
            });
        });
    }

    removeAllTokens() {
        return new Promise((resolve, reject)=>{
            this.listTokens().then((res)=>{
                var tokenRemovePromises = [];
                _.forEach(res.tokens, (token)=>{
                    tokenRemovePromises.push(this.removeToken(token.token));
                });
                return Promise.all(tokenRemovePromises);
            }).then(()=>{
                resolve();
            }).catch((err)=>{
                reject(err);
            });
        });
    }

}

module.exports.JanusAdmin = Admin;
