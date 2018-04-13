#!/usr/bin/env node

var inputStream = process.stdin
  , data = '';

process.stdin.resume();

// Read the entire input stream into the data variable.
inputStream.on('data', function(chunk) {
  data += chunk;
});

// At end of stream, load the JSON object and process it.
inputStream.on('end', function() {
  var json = JSON.parse(data);

  Object.entries(json._meta.hostvars).forEach(function(hv) {
    let hostname = hv[1].ec2_public_dns_name;
    let hostrole = hv[1].ec2_tag_Name;
    console.log("| sed -e 's/" + hostrole + "/" + hostname + "/g'");
  });
});
















