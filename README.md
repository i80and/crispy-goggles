Use
---

- Download PhantomJS from http://phantomjs.org/download.html
- Extract "phantomjs" from bin/ into this repository
- ./phantomjs ./crispy-goggles.js ./example.crispy

Command Reference
-----------------

- `click <selector>`
  - Click on the given element.
- `highlight <selector>`
  - Add a highlighting effect to the given element.
- `load <url>`
  - Load the given URL.
- `name <name>`
  - Sets the script name. Used in `render`.
- `render <suffix>`
  - Render to `<name>-<suffix>.png`.
- `scroll <selector>`
  - Scroll down to the given element.
- `set <name> = <value>`
  - Set a variable. You can use that variable with `${<name>}`.
- `setValue <selector>, <value>`
  - Assigns to the `.value` property of an element.
- `unhighlight <selector>`
  - Remove the highlighting effect on an element.
- `wait [<interval>]`
  - Waits a given interval of time. Defaults to 10 seconds.
- `waitFor <selector>`
  - Waits until a given selector exists. Times out after 10 seconds.
