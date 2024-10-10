package com.kcc.trioffice.domain.employee.dto.response;

import lombok.Data;

@Data
public class EmployeeInfo {
    private Long employeeId;
    private Long deptId;
    private Long companyId;
    private String email;
    private String password;
    private String phoneNum;
    private String externalEmail;
    private String name;
    private String birth;
    private String profileUrl;
    private String fax;
    private String location;
    private Boolean isReceiveNotification;
    private String position;
    private String status;
    private String statusMessage;
    private Long writer;
    private String writeDt;
    private Long modifier;
    private String modifiedDt;
    private String isDeleted;

}