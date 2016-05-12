const fs = require('fs')
const system = require('system')

function click(page, selector, callback) {
    const result = page.evaluate(function(selector) {
        try {
            document.querySelector(selector).click()
            return true
        } catch(err) {
            return false
        }
    }, selector)

    if(!result) {
        throw new Error('Could not select "' + selector + '"')
    }

    setTimeout(callback, 5000)
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
function doSteps(steps, callback) {
    if(steps.length === 0) { return callback() }
    stepNum += 1
    console.log('Executing step ' + stepNum + ': ' + steps[0])

    const matches = steps[0].match(/(\S+)\s*(.*)/)
    const command = matches[1]
    const arg = matches[2]
    if(command === 'name') {
        name = arg
        return doSteps(steps.slice(1), callback)
    } else if(command === 'click') {
        return click(page, arg, function() { doSteps(steps.slice(1), callback) })
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
    } else {
        console.error('Unknown command "' + command + '"')
        phantom.exit()
    }
}

const steps = []
const stream = fs.open(system.args[1], 'r')
while(!stream.atEnd()) {
    steps.push(stream.readLine().trim())
}
doSteps(steps, function() {
    phantom.exit()
})
