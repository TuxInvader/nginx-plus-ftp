function monitor_control_channel(s) {
  
  // Set this when the upstream uses the public IP in transfers
  var upstream_knows_public_address = true

  // Set this to the public IP if it's not the same as the NGINX Instance
  var public_ip_address = ""

  // Debug (set 1 to enable)
  var debug_level = 1

  // This var will be set to the LIST, STOR, or RETR command and printed
  // in the access log for each data connection.
  var xfer = ""

  s.on("upload", function(data, flags) {
    var msg = data.toString()
    if ( msg.startsWith("PASS") ) {
      msg = "PASS ************"
    } else if ( msg.startsWith("STOR") ) {
      xfer = msg.trim();
    } else if ( msg.startsWith("RETR") ) {
      xfer = msg.trim();
    } else if ( msg.startsWith("LIST") ) {
      xfer = msg.trim();
    }
    ftp_debug(s, debug_level, "command:  " + msg );
    s.send(data);
  } );

  // Process response data
  s.on("download", function(data, flasg) {

    // Debug
    ftp_debug(s, debug_level, "response: " + data.toString() );

    // PASV response
    if ( data.startsWith("227") ) {

      var pasv = data.match(/.*\(([0-9]+,[0-9]+,[0-9]+,[0-9]+),([0-9]+),([0-9]+)\).*/)
      var port = ( pasv[2] * 256 ) + (pasv[3] * 1)
      var upstream = s.variables.upstream_addr.split(',').slice(-1)[0].split(':').slice(0)[0].trim()
      var server
      var local

      if ( upstream_knows_public_address == true ) {
        ftp_debug(s,  debug_level, "Upstream knows Public IP, using: " +  pasv[1] )
        server = pasv[1].replace(/\./g,",")
        data = data.replace(pasv[1], server)
      } else if ( public_ip_address != "" ) {
        ftp_debug(s, debug_level, "Public IP provided. Using: " + public_ip_address )
        server = public_ip_address.replace(/\./g,",")
        data = data.replace(pasv[1], server)
      } else {
        ftp_debug(s, debug_level, "Passing through NGINX Address: " +  s.variables.server_addr )
        server = s.variables.server_addr.replace(/\./g,",")
        data = data.replace(pasv[1], server)
      }
      ftp_debug(s, debug_level,  "Setting: " + s.remoteAddress + ", " + port + ", " + server )
      s.variables.data_port = port;
      s.variables.upstream_socket = upstream + ":" + port;
      s.variables.upstream_server = upstream;
      ftp_debug(s, debug_level,  "Sending: " + data )
    } else if ( data.startsWith("150") ) {
      s.variables.xfer = xfer;
    }
    s.send(data);
  } );

}

function passthrough_control_channel(s) {

  // We're not decrypting, update the k/v store when a control channel
  // response is sent
  s.on("download", function(data, flags) {
      var server = s.variables.upstream_addr.split(',').pop().split(':')[0].trim();
      s.variables.upstream_server = server;
      s.send(data);
  });

}

function ftp_debug(s, level, message) {
  if ( level > 0 ) {
    s.warn( "FTP-DEBUG: " + message.trim())
  }
}

