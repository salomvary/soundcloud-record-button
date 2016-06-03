function View(el, props) {
  return Object.assign({
    show() {
      el.style.display = 'block'
    },

    hide() {
      el.style.display = 'none'
    }
  }, props)
}

function SignIn() {
  var oauthToken = localStorage.oauthToken
  var sessionUsername = localStorage.sessionUsername

  const el = document.querySelector('.sign-in')
  const username = el.querySelector('.username')
  const signOutButton = el.querySelector('.sign-out')

  signOutButton.addEventListener('click', onSignOutClick, false)

  initialize()
  render()

  function initialize() {
    SC.initialize(Object.assign({
      oauth_token: oauthToken
    }, window.Config))
  }

  function connect() {
    return SC.connect().then(onConnect)
  }

  function onConnect(session) {
    oauthToken = session.oauth_token
    if (!sessionUsername) {
      SC.get('/me').then(onMeUpdated)
    }
    save()
    return session
  }

  function onMeUpdated(me) {
    sessionUsername = me.username
    render()
    save()
  }

  function onSignOutClick(e) {
    e.preventDefault()
    oauthToken = sessionUsername = null
    initialize()
    render()
    save()
  }

  function render() {
    if (sessionUsername) {
      el.style.display = 'block'
      username.textContent = sessionUsername
    } else {
      el.style.display = 'none'
      username.textContent = ''
    }
  }

  function save() {
    if (oauthToken) {
      localStorage.oauthToken = oauthToken
    } else {
      delete localStorage.oauthToken
    }
    if (sessionUsername) {
      localStorage.sessionUsername = sessionUsername
    } else {
      delete localStorage.sessionUsername
    }
  }

  return View(el, {connect})
}

function Timer() {
  var startTime
  var interval

  const el = document.querySelector('time')

  function pad(n) {
    const s = ('00' + n)
    return s.substr(s.length - 2)
  }

  function render() {
    const time = new Date() - startTime
    if (startTime) {
      const minutes = Math.floor(time / (60 * 1000))
      const seconds = Math.floor(time % (60 * 1000) / 1000)
      el.textContent = pad(minutes) + ':' + pad(seconds)
    } else {
      el.textContent = '00:00'
    }
  }

  function reset() {
    startTime = null
    stop()
  }

  function start() {
    if (!startTime) {
      startTime = new Date()
    }
    render()
    interval = setInterval(render, 1000)
  }

  function stop() {
    clearInterval(interval)
    render()
  }

  return View(el, {reset, start, stop})
}

function Recorder({onDone}) {
  var recorder
  var recordingState = 'idle'

  const el = document.querySelector('.recorder-screen')
  const actions = el.querySelector('.actions')
  const deleteButton = el.querySelector('.delete-button')
  const nextButton = el.querySelector('.next-button')
  const recordButton = el.querySelector('.record-button')
  const statusMessage = el.querySelector('.status-message')
  const title = el.querySelector('.title')

  deleteButton.addEventListener('click', reset, false)
  nextButton.addEventListener('click', onDone, false)
  recordButton.addEventListener('click', onRecordButtonClick, false)

  const timer = Timer()

  function blob() {
    return recorder.getWAV()
  }

  function onRecordButtonClick(event) {
    event.preventDefault()
    if (!recorder) {
      recorder = new SC.Recorder()
    }
    if (recordingState == 'recording') {
      recordingState = 'paused'
      recorder.stop()
      timer.stop()
    } else if (recordingState == 'idle' || recordingState == 'paused') {
      recordingState = 'initializing'
      recorder.start().then(onRecordingStart, onRecordingStartFail)
    } else {
      throw new Error('Invalid recording state on button click: ' + recordingState)
    }
    render()
  }

  function onRecordingStart() {
    recordingState = 'recording'
    timer.start()
    render()
  }

  function onRecordingStartFail() {
    recordingState = 'fail'
    render()
  }

  function render() {
    switch (recordingState) {
    case 'idle':
      statusMessage.textContent = 'Tap to start recording'
      actions.style.visibility = 'hidden'
      title.style.display = 'inline'
      timer.hide()
      recordButton.disabled = false
      recordButton.classList.remove('active-action-button')
      break
    case 'initializing':
      statusMessage.textContent = 'Initializing microphone'
      actions.style.visibility = 'hidden'
      title.style.display = 'inline'
      timer.hide()
      recordButton.disabled = true
      recordButton.classList.add('active-action-button')
      break
    case 'fail':
      statusMessage.textContent = 'Failed to access microphone'
      actions.style.visibility = 'visible'
      title.style.display = 'inline'
      timer.hide()
      recordButton.disabled = false
      recordButton.classList.remove('active-action-button')
      break
    case 'recording':
      statusMessage.textContent = 'Tap to pause recording'
      actions.style.visibility = 'visible'
      title.style.display = 'none'
      timer.show()
      recordButton.disabled = false
      recordButton.classList.add('active-action-button')
      break
    case 'paused':
      statusMessage.textContent = 'Tap to continue recording'
      actions.style.visibility = 'visible'
      title.style.display = 'none'
      timer.show()
      recordButton.disabled = false
      recordButton.classList.remove('active-action-button')
      break
    default:
      throw new Error('Unexpected recording state ' + recordingState)
    }
  }

  function reset() {
    recorder = null
    recordingState = 'idle'
    // https://github.com/soundcloud/soundcloud-javascript/issues/60
    try { recorder.delete() } catch(e) {}
    timer.reset()
    render()
  }

  return View(el, {blob, reset})
}

function Uploader({onUploadSubmit, onDone}) {
  const el = document.querySelector('.upload-screen')
  const form = el.querySelector('form')

  form.addEventListener('submit', onSubmit, false)

  function onSubmit(e) {
    e.preventDefault()
    onUploadSubmit()
  }

  function reset() {
    form.sharing.value = 'private'
    form.title.value = ''
  }

  function upload(blob) {
    const title = form.title.value
    const sharing = form.sharing.value
    SC.upload({
      asset_data: blob,
      title: title.trim(),
      sharing: sharing,
      progress: function(event) {
        console.log('progress', event)
      }
    }).then(onDone)
  }

  return View(el, {reset, upload})
}

function Done({onDone}) {
  const el = document.querySelector('.done-screen')
  const doneButton = el.querySelector('.done-button')
  const trackTitle = el.querySelector('.track-title')

  doneButton.addEventListener('click', onDoneButtonClick, false)

  function set(track) {
    trackTitle.textContent = track.title
    var url = track.permalink_url
    if (track.sharing == 'private') {
      url += '/' + track.secret_token
    }
    trackTitle.href = url
  }

  function onDoneButtonClick() {
    onDone()
  }

  return View(el, {set})
}

function App() {
  const signIn = SignIn()
  const recorder = Recorder({onDone: onRecorderDone})
  const uploader = Uploader({onUploadSubmit: onUploadSubmit, onDone: onUploaderDone})
  const done = Done({onDone: onDone})

  function onRecorderDone() {
    recorder.hide()
    uploader.show()
  }

  function onUploadSubmit() {
    Promise.all([
      signIn.connect(),
      recorder.blob()
    ]).then(([_, blob]) => uploader.upload(blob))
  }

  function onUploaderDone(track) {
    uploader.hide()
    done.set(track)
    done.show()
  }

  function onDone() {
    done.hide()
    recorder.reset()
    uploader.hide()
    recorder.show()
  }
}

App()
