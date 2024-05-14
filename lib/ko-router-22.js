;(function (ctx) {
  "use strict"

  var router = (ctx.router = {
    on404: function (rt, e) {
      throw new Error(["Path" + router.resolvePath.apply(router, rt) + " not found.", "You can handle the error by overriding this function."].join("\n"))
    },
    current: ctx.ko.observable(),
    allroutes: {},
    route: ctx.ko.observableArray(),
    root: Page({
      title: ctx.document.title,
    }),
    resolvePath: function resolvePath() {
      var args = Array.from(arguments)
      var url = args
        .map(function (r, i, s) {
          if (r.slice(-1) !== "/" && i !== s.length - 1) r += "/"
          return r
        })
        .reduce(function (url, path) {
          return new ctx.URL(path, url.href)
        }, new ctx.URL(ctx.location.origin))
      var ret = url.pathname + url.search + url.hash
      if (ret === "") ret = "/"
      return ret.replace("//", "/")
    },
    navigate: function navigate(href, hidden) {
      var href = router.resolvePath(href)
      if(href!=="/")href=href.replace(/\/+$/,'')
      var page = router.allroutes[href]
      var newhref = href
      var offsetasterisk=0
      var patharr = path(href)
      while (offsetasterisk<=patharr.length) {
        offsetasterisk++
        if (!page) {
          
          patharr[patharr.length - offsetasterisk] = "*"
          newhref = "/" + patharr.join("/")
          page = router.allroutes[newhref]
        }
      }
      var goto = function () {
        // document.getElementById("loaderSpinner").style.display="none"
        if (router.current() && router.current().onclose) router.current().onclose(this)

        if (!hidden) {
          // console.log("pushstate", href)
          ctx.history.pushState({}, "", href)
        }
        router.route(newhref)

        if (page) {
          router.allroutes[newhref].ensureTemplate(function () {
            page.open()
          })
        }
      }
      if (page && page.guard) {
        var res = page.guard(goto)
        if (res === false) {
          console.log("check: false")
          return
        } else if (res === true) {
          console.log("check: true")
          goto()
        } else if (res === "callback") {
          document.getElementById("loaderSpinner").style.display=""
          console.log("check: waiting for callback")
        } else if (res === undefined) {
          goto()
        }
      } else {
        goto()
      }
    },
    start: function start(opts) {
      ctx.onpopstate = function (e, a) {
        router.navigate(window.location.pathname, true)
      }
    },
  })
  router.Page = Page

  ctx.ko.bindingHandlers["page"] = {
    init: function (element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
      var value = valueAccessor()
      if (!value.route) throw new Error("route required")
      var parent = element.parentNode.korouter_page || router.root
      var p = ""
      if (parent && parent.route) p = parent.route + "/"
      var fullroute = p + value.route
      var page = (parent.to[value.route] =
        parent.to[value.route] ||
        Page({
          route: fullroute,
        }))

      var randomTemplateName = "tmpl" + Math.round(Math.random() * 10000000)
      if (!value.src) {
        var tmpl = document.createElement("div")
        var cnt=element.querySelector("sectioncontent")
        var content=cnt.innerHTML
        tmpl.innerHTML = "<TEMPLATE type='text/html' id='" + randomTemplateName + "'>" + content + "</TEMPLATE>"
        ctx.document.body.appendChild(tmpl)
        cnt.remove()
      }
      Object.assign(page, {
        element: element,
        icon: value.icon,
        src: value.src,
        title: value.title || parent.title,
        template: value.template || randomTemplateName,
        guard: value.guard,
        after: value.after,
        onclose: value.onclose,
        context: bindingContext,
      })
      // if (ctx.router.routesAll.indexOf(page.fullRoute()) === -1) ctx.router.routesAll.push(page.fullRoute())
      ctx.router.allroutes[page.fullRoute()] = page
      element.korouter_page = page
    },
  }

  ctx.ko.bindingHandlers["nav"] = {
    update: function (element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
      var value = valueAccessor()
      var page = bindingContext._page || {}
      // var route = page.path ? page.path() : "/"
      var route = page && page.route ? page.route : "/"
      // var route = window.location.pathname
      if (element.tagName === "A") element.href = router.resolvePath(route, value)
      element.onclick = function (ev) {
        var href = this.href || router.resolvePath(route, value)
        if (ev.button !== 0 || (ev.ctrlKey && ev.button === 0)) {
          if (this.tagName !== "A") window.open(href, "_blank").focus()
          return true
        }
        router.navigate(href)
        return false
      }
    },
  }

  function Page(data) {
    if (!(this instanceof Page)) return new Page(data)

    data = data || {}
    this.element = data.element
    this.route = data.route
    this.title = data.title
    this.template = data.template
    this.guard = data.guard
    this.after = data.after
    this.onclose = data.onclose
    this.current = ""
    this.src = data.src
    this.context = data.context
    this.to = {}
  }
  Page.prototype.check = function check(route) {
    return wrap(this.guard, this, [route])
  }
  Page.prototype.ensureTemplate = function ensureTemplate(callback) {
    var tmplname = this.template.name || this.template
    var src = this.src
    var tmpl = ctx.document.getElementById(tmplname)
    //		var tmpl = ctx.document.querySelector('script#' + tmplname);
    if (tmpl) return callback()
    if (!tmpl && !this.src) {
    
      return console.error("No template or source supplied")
    }
    if (!tmpl && this.src)
      return ctx
        .fetch(encodeURI(this.src))
        .then(function (response) {
          if (response.status !== 200) {
            var e = new Error(response.statusText)
            e.response = response
            throw e
          }
          return response.text()
        })
        .then(function (text) {
          var doc = document.implementation.createHTMLDocument() // Sandbox
          doc.body.innerHTML = text // Parse HTML properly
          ;[].map.call(doc.getElementsByTagName("script"), function (el) {
            // eval(el.textContent);
            const dataUri = "data:text/javascript;charset=utf-8," + el.textContent
            import(dataUri)
          })

          const patt = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script\s*>/gi
          const html = document.getElementsByTagName("html")[0]
          text = text.replace(patt, "")

          if (text.toLowerCase().substr(0, 7) !== "<script") {
            text = "<template type='text/html' id='" + tmplname + "'>" + text + "</template>"
          }
          var tmpl = document.createElement("div")

          tmpl.innerHTML = text
          tmpl = tmpl.firstChild
          if (!tmpl || tmpl.tagName !== "TEMPLATE" || tmpl.id !== tmplname) throw new Error("Wrong source")
          ctx.document.body.appendChild(tmpl)
          callback()
        })
  }
  Page.prototype.open = function open(current) {
    this.current = current
    var children = Array.from(this.element.children)
    if (!this.template || !this.element) return this
    Array.from(document.querySelectorAll("sectioncontent")).map(function (c) {
      ko.cleanNode(c)
      c.remove()
    })
    Array.from(document.querySelectorAll("section")).map(function (c) {
      c.style.display = "none"
    })
    var content = this.element.querySelector("sectioncontent")
    if (!content) {
      this.element.appendChild(document.createElement("sectioncontent"))
      content = this.element.querySelector("sectioncontent")
    }
    ctx.ko.applyBindingsToNode(
      content,
      {
        template: this.template,
      },
      this.context.extend({
        _page: this,
      })
    )

    this.element.style.display = ""
    var current = this.element
    while (current.parentNode) {
      current.style.display = ""
      current = current.parentNode
    }
    if (this.after) this.after.bind(this)()
    if (router.after) router.after()
    router.current(this)
    return this
  }
  Page.prototype.close = function close() {
    this.current = ""
    var children = Array.from(this.element.children)
    Array.from(document.querySelectorAll("section")).map(function (c) {
      c.style.display = "none"
    })
  }

  Page.prototype.fullRoute = function fullRoute() {
    var path = []
    var parent = this
    do {
      path.unshift(parent.route)
      parent = parent.parent()
    } while (parent)
    return path.join("/").replace("//", "/")
  }
  Page.prototype.path = function path() {
    var path = []
    var parent = this

    do {
      path.unshift(parent.current)
      parent = parent.parent()
    } while (parent)

    return path.join("/")
  }
  Page.prototype.parent = function parent() {
    if (this === router.root) return
    try {
      return this.context._page || router.root
    } catch (e) {
      return router.root
    }
  }

  function path(pathname) {
    return (pathname || ctx.location.pathname)
      .slice(1)
      .split("/")
      .filter(function (r) {
        return !!r
      })
  }

  function wrap(target, reciever, args) {
    if (target instanceof Error) return Promise.reject(target)
    if (!(target instanceof Function)) return Promise.resolve(target)
    if (!Array.isArray(args)) args = [args]
    try {
      var r = reciever || args ? target.apply(reciever, args) : target.call()
      if (!(r instanceof Promise)) return Promise.resolve(r)
      return r
    } catch (e) {
      return Promise.reject(e)
    }
  }
})(window)
