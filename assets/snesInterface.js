let deviceList = [];
let snesDevice = null;

window.addEventListener('load', async () => {
  await initializeSNIConnection();

  // Handle SNES device change
  document.getElementById('snes-device').addEventListener('change', async (event) => {
    if (event.target.value === '-1') {
      if (serverSocket && serverSocket.readyState === WebSocket.OPEN) { serverSocket.close(); }
      snesDevice = null;
      return;
    }

    snesDevice = parseInt(event.target.value, 10);
    await setSnesDevice(event.target.value);
    if (lastServerAddress) { connectToServer(lastServerAddress, serverPassword); }
  });

  // If the user presses the refresh button, reset the SNES connection entirely
  document.getElementById('snes-device-refresh').addEventListener('click', async () => {
    await initializeSNIConnection();
  });

  window.ipc.receive('sharedData', (data) => {
    sharedData = data;
    if (sharedData.hasOwnProperty('apServerAddress')) {
      document.getElementById('server-address').value = sharedData.apServerAddress;
      connectToServer(sharedData.apServerAddress, serverPassword);
    }
  });
});

const initializeSNIConnection = async (requestedDevice = null) => {
  const snesSelect = document.getElementById('snes-device');
  snesSelect.setAttribute('disabled', '1');

  // Fetch available devices from SNI
  await window.sni.launchSNI();
  deviceList = await window.sni.fetchDevices();

  // Clear the current device list
  while(snesSelect.firstChild) { snesSelect.removeChild(snesSelect.firstChild); }

  // Add a "Select a device..." option
  const neutralOption = document.createElement('option');
  neutralOption.innerText = deviceList.length > 0 ? 'Select a device...' : 'Waiting for devices...';
  neutralOption.setAttribute('value', '-1');
  snesSelect.appendChild(neutralOption);

  // Add all SNES devices to the list
  for (let device of deviceList) {
    const deviceOption = document.createElement('option');
    deviceOption.innerText = device.uri;
    deviceOption.setAttribute('value', deviceList.indexOf(device));
    if (deviceList.indexOf(device) === parseInt(requestedDevice, 10)) { deviceOption.selected = true; }
    snesSelect.appendChild(deviceOption);
  }

  // Enable the select list if there are devices available
  if (deviceList.length > 0) {
    snesSelect.removeAttribute('disabled');
  }

  // If no snes device is found, check for one every five seconds until one is found
  if (deviceList.length === 0 ) {
    return setTimeout(initializeSNIConnection, 5000);
  }

  // If the user requested a specific device, attach to it
  if (requestedDevice) {
    return await setSnesDevice(requestedDevice);
  }

  // If only one device is available, connect to it
  if (deviceList.length === 1) {
    snesSelect.value = 0;
    snesDevice = 0;
    await setSnesDevice(0);

    // If the client was previously connected to an AP server, attempt to reconnect to it
    if (lastServerAddress) { connectToServer(lastServerAddress, serverPassword); }
  }
};

/**
 * Invoke SNI class to assign a device. This is almost instant but is technically asynchronous, so it should be awaited
 * @param device array index of deviceList
 */
const setSnesDevice = async (device) => {
  await window.sni.setDevice(deviceList[device]);
  window.ipc.send('requestSharedData');
}

/**
 * Read data from a SNES device
 * @param hexOffset Location to begin reading from SNES memory
 * @param byteCountInHex Number of bytes to read
 * @return Promise which resolves to the data retrieved from the SNES
 */
const readFromAddress = (hexOffset, byteCountInHex) => new Promise(async (resolve, reject) => {
  window.sni.readFromAddress(hexOffset, byteCountInHex)
    .then((result) => {
      resolve(result);
    })
    .catch(async (err) => {
      await window.logging.writeToLog(JSON.stringify(err));
      reject(err);
    });
});

/**
 * Write data to a SNES device
 * @param hexOffset Location to begin reading from SNES memory
 * @param data A Uint8Array of data to be written to the ROM
 * @return Promise which resolves when the SNES has completed writing its new data
 */
const writeToAddress = (hexOffset, data) => new Promise((resolve, reject) => {
  window.sni.writeToAddress(hexOffset, data)
    .then((result) => resolve(result))
    .catch(async (err) => {
      await window.logging.writeToLog(JSON.stringify(err));
      reject(err);
    });
});
