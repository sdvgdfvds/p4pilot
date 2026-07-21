"""Dock the shared p4pilot UI in Autodesk Maya."""

from __future__ import annotations

import os

from maya import cmds
from maya.app.general.mayaMixin import MayaQWidgetDockableMixin

try:
    from PySide6 import QtCore, QtWidgets
    from PySide6.QtWebEngineWidgets import QWebEngineView
except ImportError:
    try:
        from PySide2 import QtCore, QtWidgets
        from PySide2.QtWebEngineWidgets import QWebEngineView
    except ImportError as error:
        raise RuntimeError(
            "Maya's Qt WebEngine module is unavailable; install/enable QtWebEngine "
            "for this Maya version."
        ) from error


WINDOW_OBJECT = "P4PilotWorkspace"
DEFAULT_URL = "http://127.0.0.1:4715/p4pilot/?backend=local"


class P4PilotWindow(MayaQWidgetDockableMixin, QtWidgets.QWidget):
    def __init__(self, parent=None):
        super().__init__(parent=parent)
        self.setObjectName(WINDOW_OBJECT)
        self.setWindowTitle("p4pilot")
        self.resize(1100, 760)

        self._browser = QWebEngineView(self)
        self._status = QtWidgets.QLabel(self)
        self._status.setWordWrap(True)
        self._status.hide()
        retry = QtWidgets.QPushButton("Retry", self)
        retry.clicked.connect(self.reload)

        status_row = QtWidgets.QHBoxLayout()
        status_row.addWidget(self._status, 1)
        status_row.addWidget(retry)

        layout = QtWidgets.QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.addLayout(status_row)
        layout.addWidget(self._browser, 1)

        self._browser.loadFinished.connect(self._on_load_finished)
        self.reload()

    def reload(self):
        url = os.environ.get("P4PILOT_HOST_URL", DEFAULT_URL)
        self._status.hide()
        self._browser.setUrl(QtCore.QUrl(url))

    def _on_load_finished(self, ok):
        if ok:
            self._status.hide()
        else:
            self._status.setText(
                "p4pilot host is disconnected. Start p4pilot-host, then retry."
            )
            self._status.show()


_window = None


def show():
    global _window
    if _window is not None:
        _window.close()
        _window.deleteLater()
    _window = P4PilotWindow()
    _window.show(dockable=True, area="right", floating=False)
    return _window


def install_menu():
    menu_name = "P4PilotMenu"
    if cmds.menu(menu_name, exists=True):
        cmds.deleteUI(menu_name)
    menu = cmds.menu(menu_name, label="p4pilot", parent="MayaWindow", tearOff=False)
    cmds.menuItem(label="Open workspace", parent=menu, command=lambda *_: show())
    return menu
