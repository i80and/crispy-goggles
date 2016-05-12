const fs = require('fs')
const system = require('system')

function click(page, selector) {
    const coords = page.evaluate(function(selector) {
        try {
            const element = document.querySelector(selector)
            const bounds = element.getBoundingClientRect()
            return [bounds.left, bounds.top]
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
            const bounds = element.getBoundingClientRect();
            const highlight = document.createElement('div')
            highlight.className = '__phantom-highlight'
            highlight.style.position = 'absolute'
            highlight.style.top = bounds.top + 'px'
            highlight.style.left = bounds.left + 'px'
            highlight.style.width = bounds.width + 'px'
            highlight.style.height = bounds.height + 'px'
            highlight.style['background-color'] = 'rgba(128, 128, 128, 0.5)'
            highlight.style['z-index'] = 10000000
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
page.viewportSize = { width: 1024, height: 768 }
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

    const command = matches[1]
    const origArg = matches[2]

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
        return doSteps(steps.slice(1), callback)
    } else if(command === 'click') {
        click(page, arg)
        return doSteps(steps.slice(1), callback)
    } else if(command === 'load') {
        page.open(arg, function(status) {
            if(status !== 'success') {
                console.error('Failed to load')
                phantom.exit()
            }

            return doSteps(steps.slice(1), callback)
        })
    } else if(command === 'highlight') {
        highlight(page, arg)
        return doSteps(steps.slice(1), callback)
    } else if(command === 'unhighlight') {
        unhighlight(page)
        return doSteps(steps.slice(1), callback)
    } else if(command === 'render') {
        const filename = '' + name + '-' + arg + '.png'
        page.render(filename)
        return doSteps(steps.slice(1), callback)
    } else if(command === 'set') {
        const setMatches = arg.match(/(\S+)\s*=\s*(.*)/)
        if(setMatches === null) {
            console.error('Invalid "set" statement')
            phantom.exit()
        }
        const varname = setMatches[1]
        const varvalue = setMatches[2]
        variables[varname] = varvalue
        return doSteps(steps.slice(1), callback)
    } else if(command === 'wait') {
        setTimeout(function() {
            return doSteps(steps.slice(1), callback)
        }, parseInt(arg))
    } else if(command === 'setValue') {
        const setValueMatches = arg.match(/([^,]+),\s*(.*)/)
        if(setValueMatches === null) {
            console.error('invalid "setValue" statement')
            phantom.exit()
        }
        const selector = setValueMatches[1]
        const value = setValueMatches[2]

        setValue(selector, value)
        return doSteps(steps.slice(1), callback)
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
