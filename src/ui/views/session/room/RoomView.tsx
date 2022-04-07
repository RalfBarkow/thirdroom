import React from "react";

import "./RoomView.css";
import { RoomViewModel } from "../../../../viewModels/session/room/RoomViewModel";
import { Button } from "../../../atoms/button/Button";
import { IconButton } from "../../../atoms/button/IconButton";
import { ChatView } from "./ChatView";
import GridIC from "../../../../../res/ic/grid.svg";
import MicIC from "../../../../../res/ic/mic.svg";
import MessageIC from "../../../../../res/ic/message.svg";
import SettingIC from "../../../../../res/ic/setting.svg";
import LogoutIC from "../../../../../res/ic/logout.svg";

interface IRoomView {
  vm: RoomViewModel;
  roomId: string;
}

export function RoomFloatingView({ vm, roomId }: IRoomView) {
  const [chatVisibility, setChatVisibility] = React.useState(false);

  return (
    <>
      <Button size="small" iconSrc={GridIC} onClick={() => vm.toggleLeftPanel()}>
        Open Overlay [Esc]
      </Button>
      <div className={`RoomView__chat${chatVisibility === false ? " RoomView__chat--invisible" : ""}`}>
        {chatVisibility && <ChatView roomId={roomId} vm={vm.chatViewModel} />}
      </div>
      <div className="RoomView__controls flex">
        <IconButton shadedSurface={true} label="Mic" size="small" iconSrc={MicIC} onClick={() => alert("mic")} />
        <IconButton
          variant={chatVisibility ? "secondary" : "surface"}
          shadedSurface={chatVisibility ? false : true}
          label="Message"
          size="small"
          iconSrc={MessageIC}
          onClick={() => setChatVisibility(!chatVisibility)}
        />
        <IconButton
          shadedSurface={true}
          label="Settings"
          size="small"
          iconSrc={SettingIC}
          onClick={() => alert("Settings")}
        />
        <IconButton
          variant="danger"
          label="Logout"
          size="small"
          iconSrc={LogoutIC}
          onClick={() => vm.setRoomFlow("preview")}
        />
      </div>
    </>
  );
}

export function RoomView({ vm, roomId }: IRoomView) {
  return (
    <div className="RoomView grow flex">
      <div className="RoomView__3d grow" />
      <RoomFloatingView vm={vm} roomId={roomId} />
    </div>
  );
}
