var express = require('express');
var app = express();

app.use(express.static('.'));
app.use(express.static('../../dist/webcomponent'));

app.listen(4220);
