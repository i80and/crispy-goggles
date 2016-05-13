const fs = require('fs')
const system = require('system')

const waitInterval = 250
function waitFor(page, selector, callback, enlapsed) {
    const element = page.evaluate(function(selector) {
        return document.querySelector(selector)
    }, selector)

    if(element) {
        return callback(undefined, undefined)
    }

    if(enlapsed === undefined) {
        enlapsed = 0
    } else if(enlapsed > 10000) {
        return callback(undefined, 'Timed out')
    }

    setTimeout(function() {
        waitFor(page, selector, callback, enlapsed + waitInterval)
    }, waitInterval)
}

function click(page, selector) {
    const coords = page.evaluate(function(selector) {
        try {
            const element = document.querySelector(selector)
            const bounds = element.getBoundingClientRect()
            return [bounds.left + window.scrollY, bounds.top + window.scrollY]
        } catch(err) {}
    }, selector)

    if(!coords) {
        throw new Error('Could not select "' + selector + '"')
    }

    page.sendEvent('click', coords[0], coords[1])
}

function highlight(page, selector) {
    const result = page.evaluate(function(selector) {
        try {
            const element = document.querySelector(selector)
            const bounds = element.getBoundingClientRect()
            const highlight = document.createElement('div')
            highlight.className = '__phantom-highlight'
            highlight.style.position = 'absolute'
            highlight.style.top = bounds.top + window.scrollY + 'px'
            highlight.style.left = bounds.left + window.scrollX + 'px'
            highlight.style.width = bounds.width + 'px'
            highlight.style.height = bounds.height + 'px'
            highlight.style['background-color'] = 'rgba(128, 128, 128, 0.5)'
            highlight.style['z-index'] = element.style['z-index'] + 1
            document.body.appendChild(highlight)
            return true
        } catch(err) {
            return false
        }
    }, selector)

    if(!result) {
        throw new Error('Could not select "' + selector + '"')
    }
}

function unhighlight(page) {
    page.evaluate(function() {
        document.querySelector('.__phantom-highlight').remove()
    })
}

function setValue(selector, value) {
    page.evaluate(function(selector, value) {
        document.querySelector(selector).value = value
    }, selector, value)
}

const page = require('webpage').create()
page.viewportSize = { width: 1200, height: 768 }
page.clipRect = { top: 0, left: 0, width: 1200, height: 768 }
page.onError = function(msg, trace) {
    console.log(msg);
    trace.forEach(function(item) {
        console.log('  ', item.file, ':', item.line);
    });
};

var name = ''
var stepNum = 0
const variables = {}
function doSteps(steps, callback) {
    const nextStep = function() {
        try {
            doSteps(steps.slice(1), callback)
        } catch(err) {
            console.error(err)
            phantom.exit()
        }
    }

    if(steps.length === 0) { return callback() }
    if(!steps[0].trim() || steps[0].match(/^\s*#/)) {
        return doSteps(steps.slice(1), callback)
    }

    stepNum += 1
    console.log('Executing step ' + stepNum + ': ' + steps[0])

    const matches = steps[0].match(/(\S+)\s*(.*)/)
    if(matches === null) {
        console.error('Invalid rule')
        phantom.exit()
    }

    const command = matches[1].trim()
    const origArg = matches[2].trim()

    // Substitute variables
    const arg = origArg.replace(/(\$+){(\S+)}/g, function(match, dollars, varname) {
        var  newDollars = dollars.replace(/\$\$/g, '$')
        if(dollars.length % 2 === 0) {
            return newDollars
        }

        newDollars = newDollars.slice(0, newDollars.length-1)
        return newDollars + variables[varname]
    })

    if(command === 'name') {
        name = arg
        return nextStep()
    } else if(command === 'click') {
        click(page, arg)
        return nextStep()
    } else if(command === 'load') {
        page.open(arg, function(status) {
            if(status !== 'success') {
                console.error('Failed to load')
                phantom.exit()
            }

            return nextStep()
        })
    } else if(command === 'highlight') {
        highlight(page, arg)
        return nextStep()
    } else if(command === 'unhighlight') {
        unhighlight(page)
        return nextStep()
    } else if(command === 'render') {
        const filename = '' + name + '-' + arg + '.png'
        page.render(filename)
        return nextStep()
    } else if(command === 'set') {
        const setMatches = arg.match(/(\S+)\s*=\s*(.*)/)
        if(setMatches === null) {
            console.error('Invalid "set" statement')
            phantom.exit()
        }
        const varname = setMatches[1]
        const varvalue = setMatches[2]
        variables[varname] = varvalue
        return nextStep()
    } else if(command === 'wait') {
        const timeout = arg? parseInt(arg) : 10000
        setTimeout(function() {
            return nextStep()
        }, parseInt(timeout))
    } else if(command === 'waitFor') {
        waitFor(page, arg, function(status, error) {
            if(error) {
                console.error(error)
                phantom.exit()
            }

            nextStep()
        })
    } else if(command === 'setValue') {
        const setValueMatches = arg.match(/([^,]+),\s*(.*)/)
        if(setValueMatches === null) {
            console.error('invalid "setValue" statement')
            phantom.exit()
        }
        const selector = setValueMatches[1]
        const value = setValueMatches[2]

        setValue(selector, value)
        return nextStep()
    } else if(command === 'scroll') {
        if(arg === 'reset') {
            page.scrollPosition = {
              top: 0,
              left: 0
            }

            return nextStep()
        }

        const vertPos = page.evaluate(function(selector) {
            const element = document.querySelector(selector)
            if(!element) { return null }

            const bounds = element.getBoundingClientRect()
            return bounds.top
        }, arg)

        if(vertPos === null) {
            throw new Error('Could not select "' + selector + '"')
        }

        page.scrollPosition = {
          top: vertPos,
          left: 0
        }
        return nextStep()
    } else {
        console.error('Unknown command "' + command + '"')
        phantom.exit()
    }
}

function main() {
    const steps = []
    const stream = fs.open(system.args[1], 'r')
    while(!stream.atEnd()) {
        steps.push(stream.readLine().trim())
    }
    doSteps(steps, function() {
        phantom.exit()
    })
}

try {
    main()
} catch(err) {
    console.error(err)
}
