package com.kcc.trioffice.domain.attached_file.dto.response;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;

@Data
public class AttachedFileInfo {

    private Long chatId;
    private Long fileId;
    private String fileName;
    private String fileExtension;
    private Long senderId;
    private String senderName;
    private String senderProfileUrl;
    private String writeDt;
    private String sender;
    private List<String> tags;

    public void setTags(String tags) {
        if (tags == null) {
            this.tags = new ArrayList<>();

            return;
        }
        this.tags = List.of(tags.split(","));
    }
}
